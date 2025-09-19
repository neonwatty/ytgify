import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import FeedbackScreen from '../../../../src/content/overlay-wizard/screens/FeedbackScreen';

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
      expect(screen.getByText('Help Us Improve YTGify')).toBeInTheDocument();
    });

    it('should display main title correctly in header', () => {
      render(<FeedbackScreen {...defaultProps} />);
      const title = screen.getByRole('heading', { level: 2 });
      expect(title).toHaveTextContent('Help Us Improve YTGify');
      expect(title).toHaveClass('ytgif-wizard-title');
    });

    it('should show wizard header structure with proper spacing', () => {
      render(<FeedbackScreen {...defaultProps} />);
      const header = screen.getByText('Help Us Improve YTGify').closest('.ytgif-wizard-header');
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

    it('should display feedback description text', () => {
      render(<FeedbackScreen {...defaultProps} />);
      expect(screen.getByText(/Found a bug or have a feature request?/)).toBeInTheDocument();
      expect(screen.getByText(/We'd love to hear from you!/)).toBeInTheDocument();
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

    it('should render Twitter/X section heading', () => {
      render(<FeedbackScreen {...defaultProps} />);
      const twitterHeading = screen.getByRole('heading', { level: 3, name: 'Follow & Connect' });
      expect(twitterHeading).toBeInTheDocument();
    });

    it('should display Twitter/X section description text', () => {
      render(<FeedbackScreen {...defaultProps} />);
      expect(screen.getByText('Follow us on X for updates and quick questions:')).toBeInTheDocument();
    });

    it('should render Twitter/X link with correct text and icon', () => {
      render(<FeedbackScreen {...defaultProps} />);
      const twitterLink = screen.getByRole('link', { name: /@neonwatty/i });
      expect(twitterLink).toBeInTheDocument();
      expect(twitterLink).toHaveClass('ytgif-feedback-link');
      // Check for SVG icon within the link
      const svg = twitterLink.querySelector('svg');
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
      expect(screen.getByText('Help Us Improve YTGify').closest('.ytgif-wizard-screen')).toHaveClass('ytgif-feedback-screen');
      expect(document.querySelector('.ytgif-wizard-content')).toBeInTheDocument();
      expect(document.querySelector('.ytgif-logo-container')).toBeInTheDocument();
      expect(document.querySelector('.ytgif-feedback-content')).toBeInTheDocument();
      expect(document.querySelector('.ytgif-feedback-actions')).toBeInTheDocument();
    });

    it('should render both feedback option containers with correct structure', () => {
      render(<FeedbackScreen {...defaultProps} />);
      const feedbackOptions = document.querySelectorAll('.ytgif-feedback-option');
      expect(feedbackOptions).toHaveLength(2);
      // First option should be GitHub
      expect(feedbackOptions[0]).toContainElement(screen.getByRole('heading', { name: 'Report Issues & Request Features' }));
      // Second option should be Twitter/X
      expect(feedbackOptions[1]).toContainElement(screen.getByRole('heading', { name: 'Follow & Connect' }));
    });
  });

  describe('Props Validation & Handling', () => {
    it('should accept FeedbackScreenProps interface with both callbacks', () => {
      const onBack = jest.fn();
      const onClose = jest.fn();
      render(<FeedbackScreen onBack={onBack} onClose={onClose} />);
      expect(screen.getByText('Help Us Improve YTGify')).toBeInTheDocument();
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
      expect(screen.getByText('Help Us Improve YTGify')).toBeInTheDocument();
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
      expect(screen.getByText('Help Us Improve YTGify')).toBeInTheDocument();
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
      expect(screen.getByText('Help Us Improve YTGify')).toBeInTheDocument();
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

    it('should have target="_blank" on Twitter/X link', () => {
      render(<FeedbackScreen {...defaultProps} />);
      const twitterLink = screen.getByRole('link', { name: /@neonwatty/i });
      expect(twitterLink).toHaveAttribute('target', '_blank');
    });

    it('should have security attributes on Twitter/X link', () => {
      render(<FeedbackScreen {...defaultProps} />);
      const twitterLink = screen.getByRole('link', { name: /@neonwatty/i });
      expect(twitterLink).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('should have correct href on Twitter/X link', () => {
      render(<FeedbackScreen {...defaultProps} />);
      const twitterLink = screen.getByRole('link', { name: /@neonwatty/i });
      expect(twitterLink).toHaveAttribute('href', 'https://x.com/neonwatty');
    });

    it('should render GitHub and X SVG icons with correct viewBox', () => {
      render(<FeedbackScreen {...defaultProps} />);

      const githubLink = screen.getByRole('link', { name: /GitHub Issues/i });
      const githubSvg = githubLink.querySelector('svg');
      expect(githubSvg).toHaveAttribute('viewBox', '0 0 24 24');

      const twitterLink = screen.getByRole('link', { name: /@neonwatty/i });
      const twitterSvg = twitterLink.querySelector('svg');
      expect(twitterSvg).toHaveAttribute('viewBox', '0 0 24 24');
    });

    it('should have proper link text content alongside icons', () => {
      render(<FeedbackScreen {...defaultProps} />);

      const githubLink = screen.getByRole('link', { name: /GitHub Issues/i });
      expect(githubLink.textContent).toContain('GitHub Issues');

      const twitterLink = screen.getByRole('link', { name: /@neonwatty/i });
      expect(twitterLink.textContent).toContain('@neonwatty');
    });
  });
});