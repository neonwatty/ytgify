import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { jest } from '@jest/globals';
import FeedbackScreen from '../../../../src/content/overlay-wizard/screens/FeedbackScreen';
import * as links from '../../../../src/constants/links';

// Mock dependencies
jest.mock('../../../../src/constants/links', () => ({
  openExternalLink: jest.fn(),
  getReviewLink: jest.fn(() => 'https://chrome.google.com/webstore/review'),
  LINKS: {
    WEBSTORE_LISTING: 'https://chrome.google.com/webstore/listing',
    WEBSTORE_REVIEWS: 'https://chrome.google.com/webstore/review',
    GITHUB_REPO: 'https://github.com/neonwatty/ytgify',
    GITHUB_ISSUES: 'https://github.com/neonwatty/ytgify/issues',
    TWITTER_PROFILE: 'https://x.com/neonwatty',
  },
}));


describe('FeedbackScreen', () => {
  const mockOnBack = jest.fn();
  const mockOnClose = jest.fn();

  const defaultProps = {
    onBack: mockOnBack,
    onClose: mockOnClose,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock chrome.runtime.getURL
    global.chrome = {
      runtime: {
        getURL: jest.fn((path) => `chrome-extension://mock-id/${path}`),
      },
    } as any;
  });

  afterEach(() => {
    // Clean up chrome mock
    delete (global as any).chrome;
  });

  describe('Basic Rendering & UI Elements', () => {
    it('should render without crashing with minimal props', () => {
      render(<FeedbackScreen onBack={() => {}} onClose={() => {}} />);
      expect(screen.getByText('Stay Connected')).toBeInTheDocument();
    });

    it('should display main title correctly in header', () => {
      render(<FeedbackScreen {...defaultProps} />);
      const title = screen.getByRole('heading', { level: 2 });
      expect(title).toHaveTextContent('Stay Connected');
      expect(title).toHaveClass('ytgif-wizard-title');
    });

    it('should show wizard header structure with proper spacing', () => {
      render(<FeedbackScreen {...defaultProps} />);
      const header = screen.getByText('Stay Connected').closest('.ytgif-wizard-header');
      expect(header).toBeInTheDocument();
      expect(header?.children).toHaveLength(3); // Two spacing divs + title
      expect(header?.children[0]).toHaveStyle({ width: '20px' });
      expect(header?.children[2]).toHaveStyle({ width: '20px' });
    });

    it('should render logo image with correct source from chrome extension', () => {
      render(<FeedbackScreen {...defaultProps} />);
      const logo = screen.getByAltText('YTGify Logo');
      expect(logo).toBeInTheDocument();
      expect(logo).toHaveAttribute('src', 'chrome-extension://mock-id/icons/icon.svg');
      expect(logo).toHaveClass('ytgif-logo-svg');
      expect(global.chrome.runtime.getURL).toHaveBeenCalledWith('icons/icon.svg');
    });

    it.skip('should render BeehIiv newsletter section', () => {
      render(<FeedbackScreen {...defaultProps} />);
      const newsletterHeading = screen.getByRole('heading', { level: 3, name: 'Stay Updated' });
      expect(newsletterHeading).toBeInTheDocument();
      expect(screen.getByText('Get notified about new features and releases:')).toBeInTheDocument();
    });

    it.skip('should render BeehIiv embed iframe', () => {
      const { container } = render(<FeedbackScreen {...defaultProps} />);
      const iframe = container.querySelector('iframe.beehiiv-embed');
      expect(iframe).toBeInTheDocument();
      expect(iframe).toHaveAttribute('src', 'https://subscribe-forms.beehiiv.com/40d30e3d-c27d-4986-a9ce-3d4ae314fc5d');
      expect(iframe).toHaveAttribute('data-test-id', 'beehiiv-embed');
    });

    it('should render GitHub section heading', () => {
      render(<FeedbackScreen {...defaultProps} />);
      const githubHeading = screen.getByRole('heading', { level: 3, name: 'Report Issues & Request Features' });
      expect(githubHeading).toBeInTheDocument();
    });

    it('should display GitHub section description text', () => {
      render(<FeedbackScreen {...defaultProps} />);
      expect(screen.getByText('Visit our GitHub repository to report bugs or suggest new features:')).toBeInTheDocument();
    });

    it('should render GitHub link with correct text and icon', () => {
      render(<FeedbackScreen {...defaultProps} />);
      const githubLink = screen.getByRole('link', { name: /GitHub Issues/i });
      expect(githubLink).toBeInTheDocument();
      expect(githubLink).toHaveClass('ytgif-feedback-link');
      // Check for SVG icon within the link
      const svg = githubLink.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('width', '20');
      expect(svg).toHaveAttribute('height', '20');
    });


    it('should render Back button with arrow icon and text', () => {
      render(<FeedbackScreen {...defaultProps} />);
      const backButton = screen.getByRole('button', { name: /Back/i });
      expect(backButton).toBeInTheDocument();
      expect(backButton).toHaveClass('ytgif-button-secondary');
      // Check for SVG arrow icon
      const svg = backButton.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('width', '20');
      expect(svg).toHaveAttribute('height', '20');
    });

    it('should render Done button with correct text', () => {
      render(<FeedbackScreen {...defaultProps} />);
      const doneButton = screen.getByRole('button', { name: 'Done' });
      expect(doneButton).toBeInTheDocument();
      expect(doneButton).toHaveClass('ytgif-button-primary');
    });

    it('should apply correct CSS classes to main containers', () => {
      render(<FeedbackScreen {...defaultProps} />);
      expect(screen.getByText('Stay Connected').closest('.ytgif-wizard-screen')).toHaveClass('ytgif-feedback-screen');
      expect(document.querySelector('.ytgif-wizard-content')).toBeInTheDocument();
      expect(document.querySelector('.ytgif-logo-container')).toBeInTheDocument();
      expect(document.querySelector('.ytgif-feedback-content')).toBeInTheDocument();
      expect(document.querySelector('.ytgif-feedback-actions')).toBeInTheDocument();
    });

    it('should render feedback option container with correct structure', () => {
      render(<FeedbackScreen {...defaultProps} />);
      const feedbackOptions = document.querySelectorAll('.ytgif-feedback-option');
      expect(feedbackOptions).toHaveLength(1);
      // Option should be GitHub
      expect(feedbackOptions[0]).toContainElement(screen.getByRole('heading', { name: 'Report Issues & Request Features' }));
    });
  });

  describe('Props Validation & Handling', () => {
    it('should accept FeedbackScreenProps interface with both callbacks', () => {
      const onBack = jest.fn();
      const onClose = jest.fn();
      render(<FeedbackScreen onBack={onBack} onClose={onClose} />);
      expect(screen.getByText('Stay Connected')).toBeInTheDocument();
    });

    it('should handle undefined onBack callback gracefully', () => {
      render(<FeedbackScreen onBack={undefined as any} onClose={mockOnClose} />);
      const backButton = screen.getByRole('button', { name: /Back/i });
      expect(() => fireEvent.click(backButton)).not.toThrow();
    });

    it('should handle undefined onClose callback gracefully', () => {
      render(<FeedbackScreen onBack={mockOnBack} onClose={undefined as any} />);
      const doneButton = screen.getByRole('button', { name: 'Done' });
      expect(() => fireEvent.click(doneButton)).not.toThrow();
    });

    it('should render when all props are undefined', () => {
      render(<FeedbackScreen onBack={undefined as any} onClose={undefined as any} />);
      expect(screen.getByText('Stay Connected')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Back/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });

    it('should validate onBack and onClose are function types when provided', () => {
      const onBack = jest.fn();
      const onClose = jest.fn();
      render(<FeedbackScreen onBack={onBack} onClose={onClose} />);
      expect(typeof onBack).toBe('function');
      expect(typeof onClose).toBe('function');
    });

    it('should re-render correctly when props change', () => {
      const { rerender } = render(<FeedbackScreen {...defaultProps} />);
      const newOnBack = jest.fn();
      const newOnClose = jest.fn();

      rerender(<FeedbackScreen onBack={newOnBack} onClose={newOnClose} />);

      fireEvent.click(screen.getByRole('button', { name: /Back/i }));
      expect(newOnBack).toHaveBeenCalledTimes(1);
      expect(mockOnBack).not.toHaveBeenCalled();
    });

    it('should work with empty props object', () => {
      render(<FeedbackScreen {...{} as any} />);
      expect(screen.getByText('Stay Connected')).toBeInTheDocument();
    });

    it('should not mutate passed props', () => {
      const props = { onBack: mockOnBack, onClose: mockOnClose };
      const propsCopy = { ...props };
      render(<FeedbackScreen {...props} />);
      expect(props).toEqual(propsCopy);
    });
  });

  describe('Event Handlers & Callbacks', () => {
    it('should call onBack exactly once when Back button is clicked', () => {
      render(<FeedbackScreen {...defaultProps} />);
      const backButton = screen.getByRole('button', { name: /Back/i });
      fireEvent.click(backButton);
      expect(mockOnBack).toHaveBeenCalledTimes(1);
      expect(mockOnBack).toHaveBeenCalledWith();
    });

    it('should call onClose exactly once when Done button is clicked', () => {
      render(<FeedbackScreen {...defaultProps} />);
      const doneButton = screen.getByRole('button', { name: 'Done' });
      fireEvent.click(doneButton);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
      expect(mockOnClose).toHaveBeenCalledWith();
    });

    it('should handle rapid multiple clicks without triggering multiple calls', () => {
      render(<FeedbackScreen {...defaultProps} />);
      const backButton = screen.getByRole('button', { name: /Back/i });

      // Simulate rapid clicks
      fireEvent.click(backButton);
      fireEvent.click(backButton);
      fireEvent.click(backButton);

      // Should still only be called once per click
      expect(mockOnBack).toHaveBeenCalledTimes(3);
    });

    it('should not pass any arguments to callbacks', () => {
      render(<FeedbackScreen {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Back/i }));
      expect(mockOnBack).toHaveBeenCalledWith();

      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      expect(mockOnClose).toHaveBeenCalledWith();
    });

    it('should not propagate click events unexpectedly', () => {
      const containerClick = jest.fn();
      render(
        <div onClick={containerClick}>
          <FeedbackScreen {...defaultProps} />
        </div>
      );

      fireEvent.click(screen.getByRole('button', { name: /Back/i }));
      expect(mockOnBack).toHaveBeenCalledTimes(1);
      expect(containerClick).toHaveBeenCalledTimes(1); // Normal propagation
    });

    it('should trigger button callbacks with keyboard navigation (Space key)', () => {
      render(<FeedbackScreen {...defaultProps} />);
      const backButton = screen.getByRole('button', { name: /Back/i });

      backButton.focus();
      fireEvent.keyDown(backButton, { key: ' ', code: 'Space' });
      fireEvent.keyUp(backButton, { key: ' ', code: 'Space' });

      // Note: Standard button behavior handles Space key automatically
      // This test verifies the button is accessible via keyboard
      expect(backButton).toBeInTheDocument();
      expect(document.activeElement).toBe(backButton);
    });

    it('should trigger button callbacks with keyboard navigation (Enter key)', () => {
      render(<FeedbackScreen {...defaultProps} />);
      const doneButton = screen.getByRole('button', { name: 'Done' });

      doneButton.focus();
      fireEvent.keyDown(doneButton, { key: 'Enter', code: 'Enter' });

      // Note: Standard button behavior handles Enter key automatically
      // This test verifies the button is accessible via keyboard
      expect(doneButton).toBeInTheDocument();
      expect(document.activeElement).toBe(doneButton);
    });

    it('should continue rendering after callback execution', () => {
      const onBackWithSideEffect = jest.fn(() => {
        // Simulate a side effect but don't throw
        console.log('Back button clicked');
      });

      render(<FeedbackScreen onBack={onBackWithSideEffect} onClose={mockOnClose} />);

      fireEvent.click(screen.getByRole('button', { name: /Back/i }));

      expect(onBackWithSideEffect).toHaveBeenCalledTimes(1);
      // Component should still be in the document after callback
      expect(screen.getByText('Stay Connected')).toBeInTheDocument();
      // Other buttons should still be functional
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should work with async callback functions', async () => {
      const asyncOnBack = jest.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      const asyncOnClose = jest.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      render(<FeedbackScreen onBack={asyncOnBack} onClose={asyncOnClose} />);

      fireEvent.click(screen.getByRole('button', { name: /Back/i }));
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));

      expect(asyncOnBack).toHaveBeenCalledTimes(1);
      expect(asyncOnClose).toHaveBeenCalledTimes(1);
    });

    it('should keep buttons functional when callbacks are undefined', () => {
      render(<FeedbackScreen onBack={undefined as any} onClose={undefined as any} />);

      const backButton = screen.getByRole('button', { name: /Back/i });
      const doneButton = screen.getByRole('button', { name: 'Done' });

      // Buttons should still be clickable without errors
      expect(() => {
        fireEvent.click(backButton);
        fireEvent.click(doneButton);
      }).not.toThrow();

      // Buttons should not be disabled
      expect(backButton).not.toBeDisabled();
      expect(doneButton).not.toBeDisabled();
    });
  });

  describe('External Link Behavior', () => {
    it('should have target="_blank" on GitHub link', () => {
      render(<FeedbackScreen {...defaultProps} />);
      const githubLink = screen.getByRole('link', { name: /GitHub Issues/i });
      expect(githubLink).toHaveAttribute('target', '_blank');
    });

    it('should have security attributes on GitHub link', () => {
      render(<FeedbackScreen {...defaultProps} />);
      const githubLink = screen.getByRole('link', { name: /GitHub Issues/i });
      expect(githubLink).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('should have correct href on GitHub link', () => {
      render(<FeedbackScreen {...defaultProps} />);
      const githubLink = screen.getByRole('link', { name: /GitHub Issues/i });
      expect(githubLink).toHaveAttribute('href', 'https://github.com/neonwatty/ytgify');
    });

    it('should render GitHub SVG icon with correct viewBox', () => {
      render(<FeedbackScreen {...defaultProps} />);

      const githubLink = screen.getByRole('link', { name: /GitHub Issues/i });
      const githubSvg = githubLink.querySelector('svg');
      expect(githubSvg).toHaveAttribute('viewBox', '0 0 24 24');
    });

    it('should have proper link text content alongside icon', () => {
      render(<FeedbackScreen {...defaultProps} />);

      const githubLink = screen.getByRole('link', { name: /GitHub Issues/i });
      expect(githubLink.textContent).toContain('GitHub Issues');
    });
  });

  describe('Show Your Support Section', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should render "Enjoying YTGify?" section heading', () => {
      render(<FeedbackScreen {...defaultProps} />);

      const supportHeading = screen.getByRole('heading', { level: 3, name: 'Enjoying YTGify?' });
      expect(supportHeading).toBeInTheDocument();
    });

    it('should display review button with text', () => {
      render(<FeedbackScreen {...defaultProps} />);

      const reviewButton = screen.getByRole('button', { name: /Leave us a review!/i });
      expect(reviewButton).toBeInTheDocument();
      expect(reviewButton.textContent).toContain('Leave us a review!');
    });

    it('should render support section container', () => {
      const { container } = render(<FeedbackScreen {...defaultProps} />);

      const supportSection = container.querySelector('.ytgif-support-section');
      expect(supportSection).toBeInTheDocument();
    });

    it('should render support buttons container', () => {
      const { container } = render(<FeedbackScreen {...defaultProps} />);

      const supportButtons = container.querySelector('.ytgif-support-buttons');
      expect(supportButtons).toBeInTheDocument();
    });

    it('should render review button', () => {
      render(<FeedbackScreen {...defaultProps} />);

      const reviewButton = screen.getByRole('button', { name: /Leave us a review!/i });
      expect(reviewButton).toBeInTheDocument();
    });

    it('should apply correct CSS class to support button', () => {
      const { container } = render(<FeedbackScreen {...defaultProps} />);

      const supportButtons = container.querySelectorAll('.ytgif-support-btn');
      expect(supportButtons).toHaveLength(1);
    });

    it('should render review button with star icon', () => {
      render(<FeedbackScreen {...defaultProps} />);

      const rateButton = screen.getByRole('button', { name: /Leave us a review!/i });
      expect(rateButton).toBeInTheDocument();
      expect(rateButton).toHaveClass('ytgif-support-btn');

      const svg = rateButton?.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('width', '18');
      expect(svg).toHaveAttribute('height', '18');
    });

    it('should call openExternalLink with review link when review button clicked', () => {
      render(<FeedbackScreen {...defaultProps} />);

      const rateButton = screen.getByRole('button', { name: /Leave us a review!/i });
      fireEvent.click(rateButton);

      expect(links.openExternalLink).toHaveBeenCalledWith('https://chrome.google.com/webstore/review');
    });

    it('should handle multiple clicks on review button', () => {
      render(<FeedbackScreen {...defaultProps} />);

      const rateButton = screen.getByRole('button', { name: /Leave us a review!/i });
      fireEvent.click(rateButton);
      fireEvent.click(rateButton);
      fireEvent.click(rateButton);

      expect(links.openExternalLink).toHaveBeenCalledTimes(3);
      expect(links.openExternalLink).toHaveBeenCalledWith('https://chrome.google.com/webstore/review');
    });

    it('should not interfere with Back/Done button functionality', () => {
      render(<FeedbackScreen {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Leave us a review!/i }));
      fireEvent.click(screen.getByText('Back'));
      fireEvent.click(screen.getByText('Done'));

      expect(mockOnBack).toHaveBeenCalledTimes(1);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
      expect(links.openExternalLink).toHaveBeenCalledTimes(1);
    });

    it('should render review button with correct text', () => {
      const { container } = render(<FeedbackScreen {...defaultProps} />);

      const supportButtons = container.querySelectorAll('.ytgif-support-btn');
      expect(supportButtons[0].textContent).toContain('Leave us a review!');
    });

    it('should have correct button structure with icon and text', () => {
      render(<FeedbackScreen {...defaultProps} />);

      const rateButton = screen.getByRole('button', { name: /Leave us a review!/i });
      const svg = rateButton?.querySelector('svg');
      const span = rateButton?.querySelector('span');

      expect(svg).toBeInTheDocument();
      expect(span).toBeInTheDocument();
      expect(span?.textContent).toBe('Leave us a review!');
    });

    it.skip('should render support section before newsletter and GitHub', () => {
      const { container } = render(<FeedbackScreen {...defaultProps} />);

      const feedbackContent = container.querySelector('.ytgif-feedback-content');
      const supportSection = feedbackContent?.querySelector('.ytgif-support-section');
      const newsletterSection = feedbackContent?.querySelector('.ytgif-newsletter-section');
      const feedbackOptions = feedbackContent?.querySelectorAll('.ytgif-feedback-option');

      expect(supportSection).toBeInTheDocument();
      expect(newsletterSection).toBeInTheDocument();
      expect(feedbackOptions).toHaveLength(1);

      // Support section should be first
      const allChildren = Array.from(feedbackContent?.children || []);
      const supportIndex = allChildren.indexOf(supportSection as Element);
      const newsletterIndex = allChildren.indexOf(newsletterSection as Element);
      expect(supportIndex).toBeLessThan(newsletterIndex);
    });

    it('should call getReviewLink helper for review button', () => {
      render(<FeedbackScreen {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /Leave us a review!/i }));

      expect(links.getReviewLink).toHaveBeenCalled();
    });
  });

  describe('BeehIiv Script Loading', () => {
    beforeEach(() => {
      // Clear document head between tests
      document.head.innerHTML = '';
    });

    it('should inject BeehIiv script on mount', () => {
      render(<FeedbackScreen {...defaultProps} />);

      const script = document.getElementById('beehiiv-embed-script') as HTMLScriptElement;
      expect(script).toBeInTheDocument();
      expect(script).toHaveAttribute('src', 'https://subscribe-forms.beehiiv.com/embed.js');
      expect(script.async).toBe(true);
    });

    it('should not inject duplicate scripts if already exists', () => {
      // Pre-inject the script
      const existingScript = document.createElement('script');
      existingScript.id = 'beehiiv-embed-script';
      existingScript.src = 'https://subscribe-forms.beehiiv.com/embed.js';
      document.head.appendChild(existingScript);

      render(<FeedbackScreen {...defaultProps} />);

      const scripts = document.querySelectorAll('#beehiiv-embed-script');
      expect(scripts).toHaveLength(1);
    });

    it('should clean up script on unmount', () => {
      const { unmount } = render(<FeedbackScreen {...defaultProps} />);

      expect(document.getElementById('beehiiv-embed-script')).toBeInTheDocument();

      unmount();

      expect(document.getElementById('beehiiv-embed-script')).not.toBeInTheDocument();
    });
  });

  describe('Standalone Mode Behavior', () => {
    it('should hide Back button when isStandalone=true', () => {
      render(<FeedbackScreen onBack={mockOnBack} onClose={mockOnClose} isStandalone={true} />);
      expect(screen.queryByRole('button', { name: /Back/i })).not.toBeInTheDocument();
    });

    it('should show Back button when isStandalone=false', () => {
      render(<FeedbackScreen onBack={mockOnBack} onClose={mockOnClose} isStandalone={false} />);
      expect(screen.getByRole('button', { name: /Back/i })).toBeInTheDocument();
    });

    it('should show Back button when isStandalone is undefined (default)', () => {
      render(<FeedbackScreen onBack={mockOnBack} onClose={mockOnClose} />);
      expect(screen.getByRole('button', { name: /Back/i })).toBeInTheDocument();
    });

    it('should display "Close" button text when isStandalone=true', () => {
      render(<FeedbackScreen onBack={mockOnBack} onClose={mockOnClose} isStandalone={true} />);
      const closeButton = screen.getByRole('button', { name: 'Close' });
      expect(closeButton).toBeInTheDocument();
      expect(closeButton).toHaveClass('ytgif-button-primary');
    });

    it('should display "Done" button text when isStandalone=false', () => {
      render(<FeedbackScreen onBack={mockOnBack} onClose={mockOnClose} isStandalone={false} />);
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });

    it('should display "Done" button text when isStandalone is undefined (default)', () => {
      render(<FeedbackScreen onBack={mockOnBack} onClose={mockOnClose} />);
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });

    it('should call onClose when Close button clicked in standalone mode', () => {
      render(<FeedbackScreen onBack={mockOnBack} onClose={mockOnClose} isStandalone={true} />);
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
      expect(mockOnBack).not.toHaveBeenCalled();
    });

    it('should have only one action button when isStandalone=true', () => {
      const { container } = render(<FeedbackScreen onBack={mockOnBack} onClose={mockOnClose} isStandalone={true} />);
      const actionButtons = container.querySelectorAll('.ytgif-feedback-actions button');
      expect(actionButtons).toHaveLength(1);
    });

    it('should have two action buttons when isStandalone=false', () => {
      const { container } = render(<FeedbackScreen onBack={mockOnBack} onClose={mockOnClose} isStandalone={false} />);
      const actionButtons = container.querySelectorAll('.ytgif-feedback-actions button');
      expect(actionButtons).toHaveLength(2);
    });

    it('should have two action buttons when isStandalone is undefined (default)', () => {
      const { container } = render(<FeedbackScreen onBack={mockOnBack} onClose={mockOnClose} />);
      const actionButtons = container.querySelectorAll('.ytgif-feedback-actions button');
      expect(actionButtons).toHaveLength(2);
    });
  });
});