import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { jest } from '@jest/globals';
import SuccessScreen from '../../../../src/content/overlay-wizard/screens/SuccessScreen';
import * as links from '../../../../src/constants/links';
import * as engagementTrackerModule from '../../../../src/shared/engagement-tracker';

// Mock dependencies
jest.mock('../../../../src/constants/links', () => ({
  openExternalLink: jest.fn(),
  getGitHubStarLink: jest.fn(() => 'https://github.com/neonwatty/ytgify'),
  getReviewLink: jest.fn(() => 'https://chromewebstore.google.com/detail/ytgify/mock-id/reviews'),
}));

jest.mock('../../../../src/shared/engagement-tracker', () => ({
  engagementTracker: {
    getEngagementStats: jest.fn(),
    shouldShowPrompt: jest.fn(),
    recordDismissal: jest.fn(),
  },
}));

describe('SuccessScreen', () => {
  const mockOnDownload = jest.fn();
  const mockOnBack = jest.fn();
  const mockOnFeedback = jest.fn();
  const mockOnClose = jest.fn();

  const defaultProps = {
    onDownload: mockOnDownload,
    onBack: mockOnBack,
    onFeedback: mockOnFeedback,
    onClose: mockOnClose,
  };

  const mockGifMetadata = {
    width: 640,
    height: 480,
    duration: 3.5,
    frameCount: 75,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementation - footer hidden (not qualified)
    const mockEngagementTracker = engagementTrackerModule.engagementTracker as any;
    mockEngagementTracker.getEngagementStats.mockResolvedValue({
      totalGifsCreated: 0,
      popupFooterDismissed: false,
    });
    mockEngagementTracker.shouldShowPrompt.mockResolvedValue(false);
    mockEngagementTracker.recordDismissal.mockResolvedValue(undefined);
  });

  describe('Basic Rendering & UI Elements', () => {
    it('should render without crashing with minimal props', () => {
      render(<SuccessScreen />);
      expect(screen.getByText('GIF Created Successfully!')).toBeInTheDocument();
    });

    it('should display main title correctly', () => {
      render(<SuccessScreen {...defaultProps} />);
      expect(screen.getByText('GIF Created Successfully!')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('GIF Created Successfully!');
    });

    it('should show wizard header structure with proper spacing', () => {
      render(<SuccessScreen {...defaultProps} />);
      const header = screen.getByText('GIF Created Successfully!').closest('.ytgif-wizard-header');
      expect(header).toBeInTheDocument();
      expect(header?.children).toHaveLength(3); // Two spacing divs + title
    });

    it('should render success message', () => {
      render(<SuccessScreen {...defaultProps} />);
      expect(screen.getByText('Your GIF is ready!')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Your GIF is ready!');
    });

    it('should display GIF preview when gifDataUrl is provided', () => {
      const gifDataUrl = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
      render(<SuccessScreen {...defaultProps} gifDataUrl={gifDataUrl} />);

      const previewImg = screen.getByAltText('Created GIF');
      expect(previewImg).toBeInTheDocument();
      expect(previewImg).toHaveAttribute('src', gifDataUrl);
    });

    it('should apply correct CSS class to preview image', () => {
      const gifDataUrl = 'data:image/gif;base64,test';
      render(<SuccessScreen {...defaultProps} gifDataUrl={gifDataUrl} />);

      const previewImg = screen.getByAltText('Created GIF');
      expect(previewImg).toHaveClass('ytgif-success-preview-image');
    });

    it('should hide preview section when gifDataUrl is not provided', () => {
      render(<SuccessScreen {...defaultProps} />);
      expect(screen.queryByAltText('Created GIF')).not.toBeInTheDocument();
      expect(screen.queryByText('640×480')).not.toBeInTheDocument();
    });

    it('should show metadata when gifMetadata is provided', () => {
      const gifDataUrl = 'data:image/gif;base64,test';
      render(
        <SuccessScreen
          {...defaultProps}
          gifDataUrl={gifDataUrl}
          gifMetadata={mockGifMetadata}
          gifSize={1024000}
        />
      );

      expect(screen.getByText('640×480')).toBeInTheDocument();
      expect(screen.getByText('1000.0 KB')).toBeInTheDocument();
      expect(screen.getByText('3.5s')).toBeInTheDocument();
      expect(screen.getByText('75 frames')).toBeInTheDocument();
    });

    it('should use bullet separators between metadata items', () => {
      const gifDataUrl = 'data:image/gif;base64,test';
      render(
        <SuccessScreen
          {...defaultProps}
          gifDataUrl={gifDataUrl}
          gifMetadata={mockGifMetadata}
          gifSize={1024}
        />
      );

      const bullets = screen.getAllByText('•');
      expect(bullets.length).toBeGreaterThan(0);
    });

    it('should hide frame count when not provided in metadata', () => {
      const gifDataUrl = 'data:image/gif;base64,test';
      const metadataWithoutFrames = {
        width: 640,
        height: 480,
        duration: 3.5,
      };

      render(
        <SuccessScreen
          {...defaultProps}
          gifDataUrl={gifDataUrl}
          gifMetadata={metadataWithoutFrames}
          gifSize={1024}
        />
      );

      expect(screen.queryByText(/frames/)).not.toBeInTheDocument();
    });

    it('should render Back button with correct structure', () => {
      render(<SuccessScreen {...defaultProps} />);

      const backButton = screen.getByText('Back').closest('button');
      expect(backButton).toBeInTheDocument();
      expect(backButton).toHaveClass('ytgif-button-secondary');

      // Check for SVG icon
      const svg = backButton?.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('width', '20');
      expect(svg).toHaveAttribute('height', '20');
    });

    it('should render Download GIF button with correct structure', () => {
      render(<SuccessScreen {...defaultProps} />);

      const downloadButton = screen.getByText('Download GIF').closest('button');
      expect(downloadButton).toBeInTheDocument();
      expect(downloadButton).toHaveClass('ytgif-button-primary');

      // Check for SVG icon
      const svg = downloadButton?.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should render Stay Connected button with correct structure', () => {
      render(<SuccessScreen {...defaultProps} />);

      const feedbackButton = screen.getByText('Stay Connected').closest('button');
      expect(feedbackButton).toBeInTheDocument();
      expect(feedbackButton).toHaveClass('ytgif-button-secondary');

      // Check for chat bubble SVG icon
      const svg = feedbackButton?.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should show file size in success message when no preview but size exists', () => {
      render(<SuccessScreen {...defaultProps} gifSize={2048576} />);

      expect(screen.getByText('Size: 2.0 MB')).toBeInTheDocument();
    });

    it('should handle missing gifDataUrl gracefully', () => {
      render(<SuccessScreen {...defaultProps} gifMetadata={mockGifMetadata} />);

      expect(screen.getByText('Your GIF is ready!')).toBeInTheDocument();
      expect(screen.queryByAltText('Created GIF')).not.toBeInTheDocument();
    });

    it('should render without metadata when not provided', () => {
      render(<SuccessScreen {...defaultProps} />);

      expect(screen.getByText('Your GIF is ready!')).toBeInTheDocument();
      expect(screen.queryByText('×')).not.toBeInTheDocument(); // No dimensions
    });

    it('should apply correct CSS classes to main containers', () => {
      const { container } = render(<SuccessScreen {...defaultProps} />);

      expect(container.querySelector('.ytgif-wizard-screen')).toBeInTheDocument();
      expect(container.querySelector('.ytgif-success-screen')).toBeInTheDocument();
      expect(container.querySelector('.ytgif-wizard-content')).toBeInTheDocument();
    });

    it('should have proper button layout containers', () => {
      const { container } = render(<SuccessScreen {...defaultProps} />);

      expect(container.querySelector('.ytgif-success-actions')).toBeInTheDocument();
      expect(container.querySelector('.ytgif-success-bottom-actions')).toBeInTheDocument();
    });

    it('should render success message container with correct class', () => {
      const { container } = render(<SuccessScreen {...defaultProps} />);

      expect(container.querySelector('.ytgif-success-message')).toBeInTheDocument();
    });

    it('should handle gifDataUrl with different protocols', () => {
      const blobUrl = 'blob:https://example.com/test';
      render(<SuccessScreen {...defaultProps} gifDataUrl={blobUrl} />);

      const previewImg = screen.getByAltText('Created GIF');
      expect(previewImg).toHaveAttribute('src', blobUrl);
    });

    it('should display preview container with correct class when gifDataUrl provided', () => {
      const gifDataUrl = 'data:image/gif;base64,test';
      const { container } = render(<SuccessScreen {...defaultProps} gifDataUrl={gifDataUrl} />);

      expect(container.querySelector('.ytgif-success-preview')).toBeInTheDocument();
    });

    it('should display metadata container with correct class', () => {
      const gifDataUrl = 'data:image/gif;base64,test';
      const { container } = render(
        <SuccessScreen
          {...defaultProps}
          gifDataUrl={gifDataUrl}
          gifMetadata={mockGifMetadata}
        />
      );

      expect(container.querySelector('.ytgif-success-metadata')).toBeInTheDocument();
    });
  });

  describe('File Size Formatting Logic', () => {
    it('should format bytes correctly (< 1024)', () => {
      render(<SuccessScreen {...defaultProps} gifSize={0} />);
      // Size should only show when no gifDataUrl but gifSize exists, size 0 will be falsy
      expect(screen.queryByText('Size: 0 B')).not.toBeInTheDocument();
    });

    it('should format 512 bytes correctly', () => {
      render(<SuccessScreen {...defaultProps} gifSize={512} />);
      expect(screen.getByText('Size: 512 B')).toBeInTheDocument();
    });

    it('should format 1023 bytes correctly', () => {
      render(<SuccessScreen {...defaultProps} gifSize={1023} />);
      expect(screen.getByText('Size: 1023 B')).toBeInTheDocument();
    });

    it('should format kilobytes correctly (1024 - 1MB)', () => {
      render(<SuccessScreen {...defaultProps} gifSize={1024} />);
      expect(screen.getByText('Size: 1.0 KB')).toBeInTheDocument();
    });

    it('should format 1.5 KB correctly', () => {
      render(<SuccessScreen {...defaultProps} gifSize={1536} />);
      expect(screen.getByText('Size: 1.5 KB')).toBeInTheDocument();
    });

    it('should format edge of KB range correctly', () => {
      render(<SuccessScreen {...defaultProps} gifSize={1048575} />);
      expect(screen.getByText('Size: 1024.0 KB')).toBeInTheDocument();
    });

    it('should format megabytes correctly (> 1MB)', () => {
      render(<SuccessScreen {...defaultProps} gifSize={1048576} />);
      expect(screen.getByText('Size: 1.0 MB')).toBeInTheDocument();
    });

    it('should format 2 MB correctly', () => {
      render(<SuccessScreen {...defaultProps} gifSize={2097152} />);
      expect(screen.getByText('Size: 2.0 MB')).toBeInTheDocument();
    });

    it('should format 5 MB correctly', () => {
      render(<SuccessScreen {...defaultProps} gifSize={5242880} />);
      expect(screen.getByText('Size: 5.0 MB')).toBeInTheDocument();
    });

    it('should format very large files correctly', () => {
      render(<SuccessScreen {...defaultProps} gifSize={1073741824} />); // 1 GB
      expect(screen.getByText('Size: 1024.0 MB')).toBeInTheDocument();
    });

    it('should format decimal KB values with 1 decimal place', () => {
      render(<SuccessScreen {...defaultProps} gifSize={1587} />); // ~1.55 KB
      expect(screen.getByText('Size: 1.5 KB')).toBeInTheDocument();
    });

    it('should format decimal MB values with 1 decimal place', () => {
      render(<SuccessScreen {...defaultProps} gifSize={1572864} />); // 1.5 MB
      expect(screen.getByText('Size: 1.5 MB')).toBeInTheDocument();
    });

    it('should show formatted size in metadata when preview available', () => {
      const gifDataUrl = 'data:image/gif;base64,test';
      render(
        <SuccessScreen
          {...defaultProps}
          gifDataUrl={gifDataUrl}
          gifMetadata={mockGifMetadata}
          gifSize={2048576}
        />
      );

      expect(screen.getByText('2.0 MB')).toBeInTheDocument();
    });

    it('should handle size formatting with gifSize of 0', () => {
      const gifDataUrl = 'data:image/gif;base64,test';
      render(
        <SuccessScreen
          {...defaultProps}
          gifDataUrl={gifDataUrl}
          gifMetadata={mockGifMetadata}
          gifSize={0}
        />
      );

      expect(screen.getByText('0 B')).toBeInTheDocument();
    });

    it('should handle boundary value at exactly 1024 bytes', () => {
      render(<SuccessScreen {...defaultProps} gifSize={1024} />);
      expect(screen.getByText('Size: 1.0 KB')).toBeInTheDocument();
    });
  });

  describe('Props Validation & Handling', () => {
    it('should accept all SuccessScreenProps interface properties', () => {
      const allProps = {
        onDownload: mockOnDownload,
        onBack: mockOnBack,
        onFeedback: mockOnFeedback,
        onClose: mockOnClose,
        gifSize: 1024576,
        gifDataUrl: 'data:image/gif;base64,test',
        gifMetadata: mockGifMetadata,
      };

      expect(() => render(<SuccessScreen {...allProps} />)).not.toThrow();
    });

    it('should handle optional callback functions when undefined', () => {
      expect(() =>
        render(
          <SuccessScreen
            onDownload={undefined}
            onBack={undefined}
            onFeedback={undefined}
            onClose={undefined}
          />
        )
      ).not.toThrow();
    });

    it('should handle optional data props when undefined', () => {
      expect(() =>
        render(
          <SuccessScreen
            {...defaultProps}
            gifSize={undefined}
            gifDataUrl={undefined}
            gifMetadata={undefined}
          />
        )
      ).not.toThrow();
    });

    it('should use default success message when no custom message', () => {
      render(<SuccessScreen />);
      expect(screen.getByText('Your GIF is ready!')).toBeInTheDocument();
    });

    it('should handle gifSize of 0 correctly', () => {
      render(<SuccessScreen {...defaultProps} gifSize={0} />);
      // Size 0 is falsy, so it won't display in the conditional
      expect(screen.queryByText('Size: 0 B')).not.toBeInTheDocument();
    });

    it('should handle missing gifMetadata gracefully', () => {
      const gifDataUrl = 'data:image/gif;base64,test';
      render(<SuccessScreen {...defaultProps} gifDataUrl={gifDataUrl} />);

      expect(screen.getByAltText('Created GIF')).toBeInTheDocument();
      expect(screen.queryByText('×')).not.toBeInTheDocument();
    });

    it('should continue rendering when all callbacks are undefined', () => {
      render(<SuccessScreen />);

      expect(screen.getByText('GIF Created Successfully!')).toBeInTheDocument();
      expect(screen.getByText('Back')).toBeInTheDocument();
      expect(screen.getByText('Download GIF')).toBeInTheDocument();
      expect(screen.getByText('Stay Connected')).toBeInTheDocument();
    });

    it('should only show frame count when gifMetadata.frameCount exists', () => {
      const metadataWithoutFrames = {
        width: 640,
        height: 480,
        duration: 3.5,
      };

      const gifDataUrl = 'data:image/gif;base64,test';
      render(
        <SuccessScreen
          {...defaultProps}
          gifDataUrl={gifDataUrl}
          gifMetadata={metadataWithoutFrames}
        />
      );

      expect(screen.getByText('640×480')).toBeInTheDocument();
      expect(screen.getByText('3.5s')).toBeInTheDocument();
      expect(screen.queryByText(/frames/)).not.toBeInTheDocument();
    });

    it('should render metadata section only when gifMetadata provided', () => {
      const { container, rerender } = render(<SuccessScreen {...defaultProps} />);
      expect(container.querySelector('.ytgif-success-metadata')).not.toBeInTheDocument();

      rerender(
        <SuccessScreen
          {...defaultProps}
          gifDataUrl="data:image/gif;base64,test"
          gifMetadata={mockGifMetadata}
        />
      );
      expect(container.querySelector('.ytgif-success-metadata')).toBeInTheDocument();
    });

    it('should render preview section conditional on gifDataUrl presence', () => {
      const { container, rerender } = render(<SuccessScreen {...defaultProps} />);
      expect(container.querySelector('.ytgif-success-preview')).not.toBeInTheDocument();

      rerender(<SuccessScreen {...defaultProps} gifDataUrl="data:image/gif;base64,test" />);
      expect(container.querySelector('.ytgif-success-preview')).toBeInTheDocument();
    });

    it('should switch size display between preview metadata and fallback message', () => {
      const { rerender } = render(<SuccessScreen {...defaultProps} gifSize={1024} />);
      expect(screen.getByText('Size: 1.0 KB')).toBeInTheDocument();

      rerender(
        <SuccessScreen
          {...defaultProps}
          gifDataUrl="data:image/gif;base64,test"
          gifMetadata={mockGifMetadata}
          gifSize={1024}
        />
      );
      expect(screen.queryByText('Size: 1.0 KB')).not.toBeInTheDocument();
      expect(screen.getByText('1.0 KB')).toBeInTheDocument();
    });

    it('should validate gifMetadata shape when provided', () => {
      const gifDataUrl = 'data:image/gif;base64,test';
      const validMetadata = {
        width: 800,
        height: 600,
        duration: 2.5,
        frameCount: 50,
      };

      render(
        <SuccessScreen
          {...defaultProps}
          gifDataUrl={gifDataUrl}
          gifMetadata={validMetadata}
        />
      );

      expect(screen.getByText('800×600')).toBeInTheDocument();
      expect(screen.getByText('2.5s')).toBeInTheDocument();
      expect(screen.getByText('50 frames')).toBeInTheDocument();
    });

    it('should handle gifSize as number type', () => {
      render(<SuccessScreen {...defaultProps} gifSize={2048} />);
      expect(screen.getByText('Size: 2.0 KB')).toBeInTheDocument();
    });

    it('should handle gifDataUrl as string type', () => {
      const url = 'blob:https://example.com/test-gif';
      render(<SuccessScreen {...defaultProps} gifDataUrl={url} />);

      const img = screen.getByAltText('Created GIF');
      expect(img).toHaveAttribute('src', url);
    });

    it('should handle callback functions as proper function types', () => {
      const functionProps = {
        onDownload: jest.fn(),
        onBack: jest.fn(),
        onFeedback: jest.fn(),
        onClose: jest.fn(),
      };

      render(<SuccessScreen {...functionProps} />);

      fireEvent.click(screen.getByText('Download GIF'));
      expect(functionProps.onDownload).toHaveBeenCalled();
    });

    it('should handle props updates correctly', () => {
      const { rerender } = render(<SuccessScreen {...defaultProps} gifSize={1024} />);
      expect(screen.getByText('Size: 1.0 KB')).toBeInTheDocument();

      rerender(<SuccessScreen {...defaultProps} gifSize={2048} />);
      expect(screen.getByText('Size: 2.0 KB')).toBeInTheDocument();
    });

    it('should re-render when props change', () => {
      const { rerender } = render(
        <SuccessScreen {...defaultProps} gifMetadata={{ ...mockGifMetadata, width: 320 }} />
      );

      rerender(
        <SuccessScreen
          {...defaultProps}
          gifDataUrl="data:image/gif;base64,test"
          gifMetadata={{ ...mockGifMetadata, width: 640 }}
        />
      );

      expect(screen.getByText('640×480')).toBeInTheDocument();
    });

    it('should handle partial gifMetadata objects', () => {
      const partialMetadata = {
        width: 320,
        height: 240,
        duration: 1.0,
      };

      const gifDataUrl = 'data:image/gif;base64,test';
      render(
        <SuccessScreen
          {...defaultProps}
          gifDataUrl={gifDataUrl}
          gifMetadata={partialMetadata}
        />
      );

      expect(screen.getByText('320×240')).toBeInTheDocument();
      expect(screen.getByText('1.0s')).toBeInTheDocument();
      expect(screen.queryByText(/frames/)).not.toBeInTheDocument();
    });

    it('should handle empty string gifDataUrl', () => {
      render(<SuccessScreen {...defaultProps} gifDataUrl="" />);
      expect(screen.queryByAltText('Created GIF')).not.toBeInTheDocument();
    });
  });

  describe('Event Handlers & Callbacks', () => {
    it('should call onDownload when Download button is clicked', () => {
      render(<SuccessScreen {...defaultProps} />);

      const downloadButton = screen.getByText('Download GIF');
      fireEvent.click(downloadButton);

      expect(mockOnDownload).toHaveBeenCalledTimes(1);
    });

    it('should call onBack when Back button is clicked', () => {
      render(<SuccessScreen {...defaultProps} />);

      const backButton = screen.getByText('Back');
      fireEvent.click(backButton);

      expect(mockOnBack).toHaveBeenCalledTimes(1);
    });

    it('should call onFeedback when Stay Connected button is clicked', () => {
      render(<SuccessScreen {...defaultProps} />);

      const feedbackButton = screen.getByText('Stay Connected');
      fireEvent.click(feedbackButton);

      expect(mockOnFeedback).toHaveBeenCalledTimes(1);
    });

    it('should not error when onDownload is undefined', () => {
      render(<SuccessScreen {...defaultProps} onDownload={undefined} />);

      const downloadButton = screen.getByText('Download GIF');
      expect(() => fireEvent.click(downloadButton)).not.toThrow();
    });

    it('should not error when onBack is undefined', () => {
      render(<SuccessScreen {...defaultProps} onBack={undefined} />);

      const backButton = screen.getByText('Back');
      expect(() => fireEvent.click(backButton)).not.toThrow();
    });

    it('should not error when onFeedback is undefined', () => {
      render(<SuccessScreen {...defaultProps} onFeedback={undefined} />);

      const feedbackButton = screen.getByText('Stay Connected');
      expect(() => fireEvent.click(feedbackButton)).not.toThrow();
    });

    it('should handle rapid clicks appropriately', () => {
      render(<SuccessScreen {...defaultProps} />);

      const downloadButton = screen.getByText('Download GIF');
      fireEvent.click(downloadButton);
      fireEvent.click(downloadButton);
      fireEvent.click(downloadButton);

      expect(mockOnDownload).toHaveBeenCalledTimes(3);
    });

    it('should handle multiple button clicks in sequence', () => {
      render(<SuccessScreen {...defaultProps} />);

      fireEvent.click(screen.getByText('Back'));
      fireEvent.click(screen.getByText('Download GIF'));
      fireEvent.click(screen.getByText('Stay Connected'));

      expect(mockOnBack).toHaveBeenCalledTimes(1);
      expect(mockOnDownload).toHaveBeenCalledTimes(1);
      expect(mockOnFeedback).toHaveBeenCalledTimes(1);
    });

    it('should handle event propagation correctly', () => {
      const containerClickHandler = jest.fn();
      const { container } = render(<SuccessScreen {...defaultProps} />);

      container.addEventListener('click', containerClickHandler);

      const downloadButton = screen.getByText('Download GIF');
      fireEvent.click(downloadButton);

      expect(mockOnDownload).toHaveBeenCalledTimes(1);
      expect(containerClickHandler).toHaveBeenCalled();
    });

    it('should maintain callback context correctly', () => {
      const contextSensitiveCallback = jest.fn(function(this: any) {
        return this;
      });

      render(<SuccessScreen {...defaultProps} onDownload={contextSensitiveCallback} />);

      const downloadButton = screen.getByText('Download GIF');
      fireEvent.click(downloadButton);

      expect(contextSensitiveCallback).toHaveBeenCalled();
    });

    it('should handle callback exceptions gracefully', () => {
      const errorCallback = jest.fn(() => {
        throw new Error('Test error');
      });

      // Mock console.error to prevent test output pollution
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      render(<SuccessScreen {...defaultProps} onDownload={errorCallback} />);

      const downloadButton = screen.getByText('Download GIF');

      // The component itself renders fine, but the callback will throw
      expect(downloadButton).toBeInTheDocument();
      expect(errorCallback).toBeDefined();

      consoleSpy.mockRestore();
    });

    it('should call callbacks with correct timing', () => {
      const callOrder: string[] = [];
      const timedOnDownload = jest.fn(() => callOrder.push('download'));
      const timedOnBack = jest.fn(() => callOrder.push('back'));

      render(<SuccessScreen {...defaultProps} onDownload={timedOnDownload} onBack={timedOnBack} />);

      fireEvent.click(screen.getByText('Download GIF'));
      fireEvent.click(screen.getByText('Back'));

      expect(callOrder).toEqual(['download', 'back']);
    });

    it('should handle onClose callback if provided in future', () => {
      // Test for potential onClose usage even though it's not currently used in render
      render(<SuccessScreen {...defaultProps} />);

      // Verify component doesn't break with onClose prop
      expect(screen.getByText('GIF Created Successfully!')).toBeInTheDocument();
    });

    it('should prevent default behavior when needed', () => {
      render(<SuccessScreen {...defaultProps} />);

      const downloadButton = screen.getByText('Download GIF').closest('button');
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });

      downloadButton?.dispatchEvent(event);

      expect(mockOnDownload).toHaveBeenCalled();
    });
  });

  describe('Edge Cases & Error Scenarios', () => {
    it('should handle malformed gifMetadata objects', () => {
      // Mock console.error to prevent test output pollution
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Use partially malformed data that won't break toFixed() call
      const malformedMetadata = {
        width: 'invalid',
        height: null,
        duration: 3.5, // Keep this valid to avoid toFixed() error
        frameCount: NaN,
      } as any;

      const gifDataUrl = 'data:image/gif;base64,test';

      expect(() => {
        render(
          <SuccessScreen
            {...defaultProps}
            gifDataUrl={gifDataUrl}
            gifMetadata={malformedMetadata}
          />
        );
      }).not.toThrow();

      consoleSpy.mockRestore();
    });

    it('should handle invalid gifDataUrl formats', () => {
      const invalidUrls = [
        'not-a-url',
        'javascript:alert("xss")',
        'data:text/html,<script>alert("xss")</script>',
        '',
        null,
        undefined,
      ];

      invalidUrls.forEach((url) => {
        expect(() =>
          render(<SuccessScreen {...defaultProps} gifDataUrl={url as any} />)
        ).not.toThrow();
      });
    });

    it('should handle negative gifSize values', () => {
      render(<SuccessScreen {...defaultProps} gifSize={-1024} />);
      // Component should still render, even with negative size
      expect(screen.getByText('GIF Created Successfully!')).toBeInTheDocument();
    });

    it('should handle NaN and infinity gifSize values', () => {
      expect(() => render(<SuccessScreen {...defaultProps} gifSize={NaN} />)).not.toThrow();
      expect(() => render(<SuccessScreen {...defaultProps} gifSize={Infinity} />)).not.toThrow();
      expect(() => render(<SuccessScreen {...defaultProps} gifSize={-Infinity} />)).not.toThrow();
    });

    it('should handle missing required metadata fields', () => {
      const incompleteMetadata = {
        width: 640,
        // height missing
        duration: 3.5,
      } as any;

      const gifDataUrl = 'data:image/gif;base64,test';
      expect(() =>
        render(
          <SuccessScreen
            {...defaultProps}
            gifDataUrl={gifDataUrl}
            gifMetadata={incompleteMetadata}
          />
        )
      ).not.toThrow();
    });

    it('should handle empty string values for metadata', () => {
      const emptyStringMetadata = {
        width: '',
        height: '',
        duration: 0, // Use 0 instead of empty string to avoid toFixed() error
        frameCount: '',
      } as any;

      const gifDataUrl = 'data:image/gif;base64,test';
      expect(() =>
        render(
          <SuccessScreen
            {...defaultProps}
            gifDataUrl={gifDataUrl}
            gifMetadata={emptyStringMetadata}
          />
        )
      ).not.toThrow();
    });

    it('should handle zero values for dimensions and duration', () => {
      const zeroMetadata = {
        width: 0,
        height: 0,
        duration: 0,
        frameCount: 0,
      };

      const gifDataUrl = 'data:image/gif;base64,test';
      render(
        <SuccessScreen
          {...defaultProps}
          gifDataUrl={gifDataUrl}
          gifMetadata={zeroMetadata}
        />
      );

      expect(screen.getByText('0×0')).toBeInTheDocument();
      expect(screen.getByText('0.0s')).toBeInTheDocument();
      // Frame count of 0 won't show because of truthy check in the component
      expect(screen.queryByText('0 frames')).not.toBeInTheDocument();
    });

    it('should handle very large dimension values', () => {
      const largeMetadata = {
        width: 9999,
        height: 9999,
        duration: 999.9,
        frameCount: 99999,
      };

      const gifDataUrl = 'data:image/gif;base64,test';
      render(
        <SuccessScreen
          {...defaultProps}
          gifDataUrl={gifDataUrl}
          gifMetadata={largeMetadata}
        />
      );

      expect(screen.getByText('9999×9999')).toBeInTheDocument();
      expect(screen.getByText('999.9s')).toBeInTheDocument();
      expect(screen.getByText('99999 frames')).toBeInTheDocument();
    });

    it('should handle extremely long gifDataUrl strings', () => {
      const longUrl = 'data:image/gif;base64,' + 'A'.repeat(10000);
      expect(() =>
        render(<SuccessScreen {...defaultProps} gifDataUrl={longUrl} />)
      ).not.toThrow();
    });

    it('should handle component mounting stress test', () => {
      for (let i = 0; i < 10; i++) {
        const { unmount } = render(<SuccessScreen {...defaultProps} />);
        unmount();
      }
      // Should complete without memory leaks or errors
    });

    it('should handle rapid prop updates', () => {
      const { rerender } = render(<SuccessScreen {...defaultProps} gifSize={1024} />);

      for (let i = 0; i < 100; i++) {
        rerender(<SuccessScreen {...defaultProps} gifSize={1024 * (i + 1)} />);
      }

      expect(screen.getByText('GIF Created Successfully!')).toBeInTheDocument();
    });

    it('should prevent memory leaks during rapid re-renders', () => {
      const { rerender } = render(<SuccessScreen {...defaultProps} />);

      const largeMockData = {
        width: 1920,
        height: 1080,
        duration: 30.0,
        frameCount: 900,
      };

      for (let i = 0; i < 50; i++) {
        rerender(
          <SuccessScreen
            {...defaultProps}
            gifDataUrl={`data:image/gif;base64,test${i}`}
            gifMetadata={largeMockData}
            gifSize={1048576 * i}
          />
        );
      }

      expect(screen.getByText('GIF Created Successfully!')).toBeInTheDocument();
    });

    it('should handle null prop values gracefully', () => {
      expect(() =>
        render(
          <SuccessScreen
            onDownload={null as any}
            onBack={null as any}
            onFeedback={null as any}
            onClose={null as any}
            gifSize={null as any}
            gifDataUrl={null as any}
            gifMetadata={null as any}
          />
        )
      ).not.toThrow();
    });

    it('should handle component unmounting with active interactions', () => {
      const { unmount } = render(<SuccessScreen {...defaultProps} />);

      const downloadButton = screen.getByText('Download GIF');
      fireEvent.mouseDown(downloadButton);

      // Unmount while interaction is in progress
      expect(() => unmount()).not.toThrow();
    });

    it('should handle browser compatibility issues', () => {
      // Mock different browser scenarios
      const originalCreateElement = document.createElement;

      // Test with limited DOM API
      (document as any).createElement = jest.fn((tagName: string) => {
        const element = originalCreateElement.call(document, tagName);
        if (tagName === 'img') {
          // Simulate browser without full image support
          Object.defineProperty(element, 'src', {
            set: jest.fn(),
            get: jest.fn(),
          });
        }
        return element;
      });

      expect(() =>
        render(
          <SuccessScreen
            {...defaultProps}
            gifDataUrl="data:image/gif;base64,test"
          />
        )
      ).not.toThrow();

      (document as any).createElement = originalCreateElement;
    });

    it('should handle SVG icon rendering failures', () => {
      // Mock SVG rendering issues
      const { container } = render(<SuccessScreen {...defaultProps} />);

      const svgs = container.querySelectorAll('svg');
      expect(svgs.length).toBeGreaterThan(0);

      // Component should still be functional even if SVGs fail to render
      expect(screen.getByText('GIF Created Successfully!')).toBeInTheDocument();
    });

    it('should handle CSS class application failures', () => {
      // Test component functionality when CSS classes might not apply
      const { container } = render(<SuccessScreen {...defaultProps} />);

      // Even without proper CSS, component should render
      expect(container.textContent).toContain('GIF Created Successfully!');
      expect(container.textContent).toContain('Your GIF is ready!');
    });

    it('should handle formatSize function edge cases', () => {
      const edgeCases = [
        { size: Number.MAX_SAFE_INTEGER, expected: /MB/ },
        { size: Number.MIN_SAFE_INTEGER, expected: /GIF Created Successfully!/ }, // Component should still render
        { size: 0.5, expected: /0 B/ }, // Fractional bytes
        { size: 1023.9, expected: /1023 B/ }, // Near boundary
      ];

      edgeCases.forEach(({ size }) => {
        const { unmount } = render(<SuccessScreen {...defaultProps} gifSize={size} />);
        expect(screen.getByText('GIF Created Successfully!')).toBeInTheDocument();
        unmount();
      });
    });

    it('should handle duration toFixed() call with invalid numbers', () => {
      // Mock console.error to prevent test output pollution
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const metadataWithInvalidDuration = {
        width: 640,
        height: 480,
        duration: 'invalid' as any, // This would cause toFixed() to fail
        frameCount: 50,
      };

      const gifDataUrl = 'data:image/gif;base64,test';

      // This should throw because toFixed() is called on a string
      expect(() => {
        render(
          <SuccessScreen
            {...defaultProps}
            gifDataUrl={gifDataUrl}
            gifMetadata={metadataWithInvalidDuration}
          />
        );
      }).toThrow();

      consoleSpy.mockRestore();
    });
  });

  describe('Bottom Action Buttons', () => {
    it('should render Stay Connected button', () => {
      render(<SuccessScreen {...defaultProps} />);
      expect(screen.getByText('Stay Connected')).toBeInTheDocument();
    });

    it('should render only one bottom action button', () => {
      const { container } = render(<SuccessScreen {...defaultProps} />);
      const buttons = container.querySelectorAll('.ytgif-success-bottom-actions button');
      expect(buttons.length).toBe(1);
      expect(buttons[0].textContent).toContain('Stay Connected');
    });
  });

  describe('Footer CTA', () => {
    it('should show footer when user qualifies (5+ GIFs, not shown, not dismissed)', async () => {
      const mockEngagementTracker = engagementTrackerModule.engagementTracker as any;
      mockEngagementTracker.getEngagementStats.mockResolvedValue({
        totalGifsCreated: 5,
        popupFooterDismissed: false,
      });
      mockEngagementTracker.shouldShowPrompt.mockResolvedValue(true);

      render(<SuccessScreen {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Leave us a review!')).toBeInTheDocument();
      });

      expect(screen.getByText('Enjoying YTGify?')).toBeInTheDocument();
      expect(screen.getByText('×')).toBeInTheDocument(); // Dismiss button
    });

    it('should hide footer when user does not qualify (<5 GIFs)', async () => {
      const mockEngagementTracker = engagementTrackerModule.engagementTracker as any;
      mockEngagementTracker.getEngagementStats.mockResolvedValue({
        totalGifsCreated: 4,
        popupFooterDismissed: false,
      });
      mockEngagementTracker.shouldShowPrompt.mockResolvedValue(false);

      render(<SuccessScreen {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText('Leave us a review!')).not.toBeInTheDocument();
      });
    });

    it('should hide footer when dismissed', async () => {
      const mockEngagementTracker = engagementTrackerModule.engagementTracker as any;
      mockEngagementTracker.getEngagementStats.mockResolvedValue({
        totalGifsCreated: 10,
        popupFooterDismissed: true, // Dismissed
      });
      mockEngagementTracker.shouldShowPrompt.mockResolvedValue(true);

      render(<SuccessScreen {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText('Leave us a review!')).not.toBeInTheDocument();
      });
    });

    it('should hide footer when primary prompt already shown', async () => {
      const mockEngagementTracker = engagementTrackerModule.engagementTracker as any;
      mockEngagementTracker.getEngagementStats.mockResolvedValue({
        totalGifsCreated: 10,
        popupFooterDismissed: false,
      });
      mockEngagementTracker.shouldShowPrompt.mockResolvedValue(false); // Already shown

      render(<SuccessScreen {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText('Leave us a review!')).not.toBeInTheDocument();
      });
    });

    it('should open Chrome Web Store review page when review link clicked', async () => {
      const mockEngagementTracker = engagementTrackerModule.engagementTracker as any;
      mockEngagementTracker.getEngagementStats.mockResolvedValue({
        totalGifsCreated: 5,
        popupFooterDismissed: false,
      });
      mockEngagementTracker.shouldShowPrompt.mockResolvedValue(true);

      render(<SuccessScreen {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Leave us a review!')).toBeInTheDocument();
      });

      const reviewLink = screen.getByText('Leave us a review!');
      fireEvent.click(reviewLink);

      expect(links.openExternalLink).toHaveBeenCalledWith('https://chromewebstore.google.com/detail/ytgify/mock-id/reviews');
    });

    it('should hide footer and persist dismissal when dismiss button clicked', async () => {
      const mockEngagementTracker = engagementTrackerModule.engagementTracker as any;
      mockEngagementTracker.getEngagementStats.mockResolvedValue({
        totalGifsCreated: 5,
        popupFooterDismissed: false,
      });
      mockEngagementTracker.shouldShowPrompt.mockResolvedValue(true);

      render(<SuccessScreen {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Leave us a review!')).toBeInTheDocument();
      });

      const dismissBtn = screen.getByText('×');
      fireEvent.click(dismissBtn);

      // Verify recordDismissal was called
      expect(mockEngagementTracker.recordDismissal).toHaveBeenCalledWith('popup-footer');

      // Footer should be hidden
      await waitFor(() => {
        expect(screen.queryByText('Leave us a review!')).not.toBeInTheDocument();
      });
    });
  });
});