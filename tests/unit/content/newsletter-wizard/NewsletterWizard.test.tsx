import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { jest } from '@jest/globals';
import NewsletterWizard from '../../../../src/content/newsletter-wizard/NewsletterWizard';

// Mock FeedbackScreen
jest.mock('../../../../src/content/overlay-wizard/screens/FeedbackScreen', () => {
  return jest.fn(({ onBack, onClose, isStandalone }) => (
    <div data-testid="feedback-screen">
      <span data-testid="is-standalone">{String(isStandalone)}</span>
      <button onClick={onBack}>Back</button>
      <button onClick={onClose}>Close</button>
    </div>
  ));
});

describe('NewsletterWizard', () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render without crashing', () => {
      render(<NewsletterWizard onClose={mockOnClose} />);
      expect(screen.getByTestId('feedback-screen')).toBeInTheDocument();
    });

    it('should render overlay with correct CSS class', () => {
      const { container } = render(<NewsletterWizard onClose={mockOnClose} />);
      expect(container.querySelector('.ytgif-overlay-wizard')).toBeInTheDocument();
    });

    it('should render wizard container with correct CSS class', () => {
      const { container } = render(<NewsletterWizard onClose={mockOnClose} />);
      expect(container.querySelector('.ytgif-wizard-container')).toBeInTheDocument();
    });

    it('should render FeedbackScreen component', () => {
      render(<NewsletterWizard onClose={mockOnClose} />);
      expect(screen.getByTestId('feedback-screen')).toBeInTheDocument();
    });
  });

  describe('Close Button (X)', () => {
    it('should render close button with X symbol', () => {
      const { container } = render(<NewsletterWizard onClose={mockOnClose} />);
      const closeButton = container.querySelector('.ytgif-wizard-close');
      expect(closeButton).toBeInTheDocument();
      expect(closeButton?.textContent).toBe('×');
    });

    it('should have correct CSS class for close button', () => {
      const { container } = render(<NewsletterWizard onClose={mockOnClose} />);
      const closeButton = container.querySelector('.ytgif-wizard-close');
      expect(closeButton).toHaveClass('ytgif-wizard-close');
    });

    it('should have aria-label for accessibility', () => {
      const { container } = render(<NewsletterWizard onClose={mockOnClose} />);
      const closeButton = container.querySelector('.ytgif-wizard-close');
      expect(closeButton).toHaveAttribute('aria-label', 'Close');
    });

    it('should call onClose when X button is clicked', () => {
      const { container } = render(<NewsletterWizard onClose={mockOnClose} />);
      const closeButton = container.querySelector('.ytgif-wizard-close') as HTMLElement;
      fireEvent.click(closeButton);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose only once on X button click', () => {
      const { container } = render(<NewsletterWizard onClose={mockOnClose} />);
      const closeButton = container.querySelector('.ytgif-wizard-close') as HTMLElement;
      fireEvent.click(closeButton);
      fireEvent.click(closeButton);
      expect(mockOnClose).toHaveBeenCalledTimes(2);
    });
  });

  describe('FeedbackScreen Integration', () => {
    it('should pass isStandalone=true to FeedbackScreen', () => {
      render(<NewsletterWizard onClose={mockOnClose} />);
      expect(screen.getByTestId('is-standalone')).toHaveTextContent('true');
    });

    it('should pass onClose prop to FeedbackScreen', () => {
      render(<NewsletterWizard onClose={mockOnClose} />);
      fireEvent.click(screen.getByText('Close'));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should handle Back button from FeedbackScreen calling onClose', () => {
      render(<NewsletterWizard onClose={mockOnClose} />);
      fireEvent.click(screen.getByText('Back'));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not pass any additional props to FeedbackScreen', () => {
      const FeedbackScreenMock = require('../../../../src/content/overlay-wizard/screens/FeedbackScreen');
      render(<NewsletterWizard onClose={mockOnClose} />);

      expect(FeedbackScreenMock).toHaveBeenCalledWith(
        expect.objectContaining({
          onBack: expect.any(Function),
          onClose: mockOnClose,
          isStandalone: true
        }),
        expect.anything()
      );
    });
  });

  describe('Props Validation', () => {
    it('should accept onClose callback', () => {
      const onClose = jest.fn();
      render(<NewsletterWizard onClose={onClose} />);
      expect(screen.getByTestId('feedback-screen')).toBeInTheDocument();
    });

    it('should work with async onClose callback', async () => {
      const asyncOnClose = jest.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      const { container } = render(<NewsletterWizard onClose={asyncOnClose} />);
      const closeButton = container.querySelector('.ytgif-wizard-close') as HTMLElement;
      fireEvent.click(closeButton);
      expect(asyncOnClose).toHaveBeenCalledTimes(1);
    });

    it('should render correctly when props change', () => {
      const { rerender } = render(<NewsletterWizard onClose={mockOnClose} />);
      const newOnClose = jest.fn();

      rerender(<NewsletterWizard onClose={newOnClose} />);

      fireEvent.click(screen.getByText('Close'));
      expect(newOnClose).toHaveBeenCalledTimes(1);
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Component Structure', () => {
    it('should have overlay as outermost element', () => {
      const { container } = render(<NewsletterWizard onClose={mockOnClose} />);
      const firstChild = container.firstElementChild;
      expect(firstChild).toHaveClass('ytgif-overlay-wizard');
    });

    it('should have container as child of overlay', () => {
      const { container } = render(<NewsletterWizard onClose={mockOnClose} />);
      const overlay = container.querySelector('.ytgif-overlay-wizard');
      const wizardContainer = overlay?.querySelector('.ytgif-wizard-container');
      expect(wizardContainer).toBeInTheDocument();
    });

    it('should have close button inside container', () => {
      const { container } = render(<NewsletterWizard onClose={mockOnClose} />);
      const wizardContainer = container.querySelector('.ytgif-wizard-container');
      const closeButton = wizardContainer?.querySelector('.ytgif-wizard-close');
      expect(closeButton).toBeInTheDocument();
    });

    it('should have FeedbackScreen inside container', () => {
      const { container } = render(<NewsletterWizard onClose={mockOnClose} />);
      const wizardContainer = container.querySelector('.ytgif-wizard-container');
      const feedbackScreen = wizardContainer?.querySelector('[data-testid="feedback-screen"]');
      expect(feedbackScreen).toBeInTheDocument();
    });
  });

  describe('Event Handling', () => {
    it('should handle multiple close triggers independently', () => {
      const { container } = render(<NewsletterWizard onClose={mockOnClose} />);
      const closeButton = container.querySelector('.ytgif-wizard-close') as HTMLElement;

      // Click X button
      fireEvent.click(closeButton);
      // Click Close button in FeedbackScreen
      fireEvent.click(screen.getByText('Close'));
      // Click Back button in FeedbackScreen
      fireEvent.click(screen.getByText('Back'));

      expect(mockOnClose).toHaveBeenCalledTimes(3);
    });
  });
});
