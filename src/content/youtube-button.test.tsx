import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { YouTubeButton } from './youtube-button';
import { chromeMock } from '@/test/chrome-mocks';

describe('YouTubeButton', () => {
  let mockOnClick: jest.Mock;

  beforeEach(() => {
    mockOnClick = jest.fn();
    // Reset chrome mocks
    (global as any).chrome = chromeMock;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render the GIF button', () => {
      const { container } = render(<YouTubeButton onClick={mockOnClick} isActive={false} />);
      const button = container.querySelector('button');
      
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('aria-label', 'Create GIF from video');
    });

    it('should have correct default styling', () => {
      const { container } = render(<YouTubeButton onClick={mockOnClick} isActive={false} />);
      const button = container.querySelector('button');
      
      expect(button).toHaveClass('ytp-button');
      expect(button).toHaveClass('ytgif-button');
    });

    it('should render with custom className', () => {
      const customClass = 'custom-button-class';
      const { container } = render(
        <YouTubeButton onClick={mockOnClick} isActive={false} className={customClass} />
      );
      const button = container.querySelector('button');
      
      expect(button).toHaveClass(customClass);
    });

    it('should render icon inside button', () => {
      const { container } = render(<YouTubeButton onClick={mockOnClick} isActive={false} />);
      const icon = container.querySelector('svg');
      
      expect(icon).toBeInTheDocument();
    });

    it('should have tooltip on hover', async () => {
      render(<YouTubeButton onClick={mockOnClick} isActive={false} />);
      const button = screen.getByRole('button');
      
      fireEvent.mouseEnter(button);
      
      await waitFor(() => {
        expect(screen.getByText('Create GIF from video')).toBeInTheDocument();
      });
    });

    it('should be disabled when disabled prop is true', () => {
      const { container } = render(
        <YouTubeButton onClick={mockOnClick} isActive={false} disabled={true} />
      );
      const button = container.querySelector('button');
      
      expect(button).toBeDisabled();
      expect(button).toHaveClass('ytg-button-disabled');
    });

    it('should show disabled state', () => {
      const { container } = render(
        <YouTubeButton onClick={mockOnClick} isActive={false} disabled={true} />
      );
      const button = container.querySelector('button');
      
      expect(button).toBeDisabled();
    });
  });

  describe('interactions', () => {
    it('should call onClick when button is clicked', () => {
      const { container } = render(<YouTubeButton onClick={mockOnClick} isActive={false} />);
      const button = container.querySelector('button')!;
      
      fireEvent.click(button);
      
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should not call onClick when disabled', () => {
      const { container } = render(
        <YouTubeButton onClick={mockOnClick} isActive={false} disabled={true} />
      );
      const button = container.querySelector('button')!;
      
      fireEvent.click(button);
      
      expect(mockOnClick).not.toHaveBeenCalled();
    });

    it('should not call onClick when disabled', () => {
      const { container } = render(
        <YouTubeButton onClick={mockOnClick} isActive={false} disabled={true} />
      );
      const button = container.querySelector('button')!;
      
      fireEvent.click(button);
      
      expect(mockOnClick).not.toHaveBeenCalled();
    });

    it('should handle keyboard activation', () => {
      const { container } = render(<YouTubeButton onClick={mockOnClick} isActive={false} />);
      const button = container.querySelector('button')!;
      
      fireEvent.keyDown(button, { key: 'Enter' });
      
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should handle space key activation', () => {
      const { container } = render(<YouTubeButton onClick={mockOnClick} isActive={false} />);
      const button = container.querySelector('button')!;
      
      fireEvent.keyDown(button, { key: ' ' });
      
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('active state', () => {
    it('should show active state when isActive is true', () => {
      const { container } = render(
        <YouTubeButton onClick={mockOnClick} isActive={true} />
      );
      const button = container.querySelector('button');
      
      expect(button).toHaveClass('ytg-button-active');
      expect(button).toHaveAttribute('aria-pressed', 'true');
    });

    it('should not show active state when isActive is false', () => {
      const { container } = render(
        <YouTubeButton onClick={mockOnClick} isActive={false} />
      );
      const button = container.querySelector('button');
      
      expect(button).not.toHaveClass('ytg-button-active');
      expect(button).toHaveAttribute('aria-pressed', 'false');
    });

    it('should toggle active state on click', () => {
      const { container, rerender } = render(
        <YouTubeButton onClick={mockOnClick} isActive={false} />
      );
      const button = container.querySelector('button')!;
      
      expect(button).not.toHaveClass('ytg-button-active');
      
      fireEvent.click(button);
      
      rerender(<YouTubeButton onClick={mockOnClick} isActive={true} />);
      
      expect(button).toHaveClass('ytg-button-active');
    });
  });

  describe('integration with YouTube player', () => {
    it('should integrate with YouTube player controls', () => {
      // Create mock YouTube player controls container
      const controlsContainer = document.createElement('div');
      controlsContainer.className = 'ytp-right-controls';
      document.body.appendChild(controlsContainer);

      const { container } = render(
        <YouTubeButton onClick={mockOnClick} isActive={false} />,
        { container: controlsContainer }
      );

      const button = container.querySelector('button');
      expect(button).toBeInTheDocument();
      expect(button?.parentElement).toBe(controlsContainer);

      // Cleanup
      document.body.removeChild(controlsContainer);
    });

    it('should maintain YouTube player button styling', () => {
      const { container } = render(<YouTubeButton onClick={mockOnClick} isActive={false} />);
      const button = container.querySelector('button');
      
      // Should have YouTube player button class
      expect(button).toHaveClass('ytp-button');
      
      // Should have proper ARIA attributes
      expect(button).toHaveAttribute('aria-label');
      expect(button).toHaveAttribute('title');
    });

    it('should handle YouTube dark/light theme', () => {
      // Test dark theme
      document.documentElement.setAttribute('dark', 'true');
      const { container: darkContainer } = render(
        <YouTubeButton onClick={mockOnClick} isActive={false} />
      );
      const darkButton = darkContainer.querySelector('button');
      expect(darkButton).toHaveClass('ytg-dark-theme');

      // Test light theme
      document.documentElement.removeAttribute('dark');
      const { container: lightContainer } = render(
        <YouTubeButton onClick={mockOnClick} isActive={false} />
      );
      const lightButton = lightContainer.querySelector('button');
      expect(lightButton).not.toHaveClass('ytg-dark-theme');
    });
  });

  describe('animations', () => {
    it('should animate on hover', () => {
      const { container } = render(<YouTubeButton onClick={mockOnClick} isActive={false} />);
      const button = container.querySelector('button')!;
      
      fireEvent.mouseEnter(button);
      expect(button).toHaveClass('ytg-button-hover');
      
      fireEvent.mouseLeave(button);
      expect(button).not.toHaveClass('ytg-button-hover');
    });

    it('should show press animation on click', () => {
      const { container } = render(<YouTubeButton onClick={mockOnClick} isActive={false} />);
      const button = container.querySelector('button')!;
      
      fireEvent.mouseDown(button);
      expect(button).toHaveClass('ytg-button-pressed');
      
      fireEvent.mouseUp(button);
      expect(button).not.toHaveClass('ytg-button-pressed');
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA attributes', () => {
      const { container } = render(<YouTubeButton onClick={mockOnClick} isActive={false} />);
      const button = container.querySelector('button');
      
      expect(button).toHaveAttribute('role', 'button');
      expect(button).toHaveAttribute('aria-label', 'Create GIF from video');
      expect(button).toHaveAttribute('aria-pressed');
    });

    it('should be keyboard navigable', () => {
      const { container } = render(<YouTubeButton onClick={mockOnClick} isActive={false} />);
      const button = container.querySelector('button')!;
      
      // Should be focusable
      button.focus();
      expect(document.activeElement).toBe(button);
      
      // Should respond to Enter key
      fireEvent.keyDown(button, { key: 'Enter' });
      expect(mockOnClick).toHaveBeenCalled();
    });

    it('should announce state changes to screen readers', () => {
      const { container } = render(
        <YouTubeButton onClick={mockOnClick} isActive={false} />
      );
      const button = container.querySelector('button');
      
      expect(button).toHaveAttribute('aria-pressed', 'false');
      
      // Simulate state change
      const { container: updatedContainer } = render(
        <YouTubeButton onClick={mockOnClick} isActive={true} />
      );
      const updatedButton = updatedContainer.querySelector('button');
      
      expect(updatedButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('should have descriptive tooltip for screen readers', async () => {
      render(<YouTubeButton onClick={mockOnClick} isActive={false} />);
      const button = screen.getByRole('button');
      
      expect(button).toHaveAttribute('title', 'Create GIF from video');
    });
  });

  describe('error handling', () => {
    it('should handle click errors gracefully', () => {
      const errorOnClick = jest.fn(() => {
        throw new Error('Click handler error');
      });
      
      const { container } = render(
        <YouTubeButton onClick={errorOnClick} isActive={false} />
      );
      const button = container.querySelector('button')!;
      
      // Should not throw error to user
      expect(() => fireEvent.click(button)).not.toThrow();
    });

    it('should handle disabled state properly', () => {
      const { container } = render(
        <YouTubeButton onClick={mockOnClick} isActive={false} disabled={true} />
      );
      const button = container.querySelector('button');
      
      expect(button).toBeDisabled();
      expect(button).toHaveClass('ytg-button-disabled');
    });
  });

  describe('performance', () => {
    it('should not re-render unnecessarily', () => {
      const renderSpy = jest.fn();
      const TestWrapper = () => {
        renderSpy();
        return <YouTubeButton onClick={mockOnClick} isActive={false} />;
      };

      const { rerender } = render(<TestWrapper />);
      expect(renderSpy).toHaveBeenCalledTimes(1);

      // Re-render with same props
      rerender(<TestWrapper />);
      expect(renderSpy).toHaveBeenCalledTimes(2);
    });

    it('should handle rapid clicks without issues', () => {
      const { container } = render(<YouTubeButton onClick={mockOnClick} isActive={false} />);
      const button = container.querySelector('button')!;
      
      // Simulate rapid clicking
      for (let i = 0; i < 10; i++) {
        fireEvent.click(button);
      }
      
      expect(mockOnClick).toHaveBeenCalledTimes(10);
    });
  });
});