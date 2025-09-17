import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TimelineScrubber } from '../../../src/content/overlay-wizard/components/TimelineScrubber';

describe('TimelineScrubber', () => {
  const defaultProps = {
    duration: 30,
    startTime: 0,
    endTime: 5,
    currentTime: 2,
    onRangeChange: jest.fn(),
    onSeek: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Slider Value Changes', () => {
    it('should initialize slider with correct duration', () => {
      render(<TimelineScrubber {...defaultProps} />);
      const slider = screen.getByRole('slider', { name: /GIF duration/i });
      expect(slider).toHaveValue('5');
    });

    it('should update duration when slider changes', () => {
      render(<TimelineScrubber {...defaultProps} />);
      const slider = screen.getByRole('slider', { name: /GIF duration/i });

      fireEvent.change(slider, { target: { value: '7.5' } });

      expect(defaultProps.onRangeChange).toHaveBeenCalledWith(0, 7.5);
    });

    it('should display current slider value', () => {
      const { container } = render(<TimelineScrubber {...defaultProps} />);
      const valueDisplay = container.querySelector('.ytgif-slider-value');
      expect(valueDisplay).toHaveTextContent('5.0s');

      const slider = screen.getByRole('slider', { name: /GIF duration/i });
      fireEvent.change(slider, { target: { value: '7.5' } });

      // Re-render with updated props
      const { container: newContainer } = render(<TimelineScrubber {...defaultProps} endTime={7.5} />);
      const updatedValueDisplay = newContainer.querySelector('.ytgif-slider-value');
      expect(updatedValueDisplay).toHaveTextContent('7.5s');
    });

    it('should sync slider value when timeline handles are dragged', () => {
      const { rerender } = render(<TimelineScrubber {...defaultProps} />);

      // Simulate handle drag by changing props
      rerender(<TimelineScrubber {...defaultProps} startTime={2} endTime={10} />);

      const slider = screen.getByRole('slider', { name: /GIF duration/i });
      expect(slider).toHaveValue('8');
    });
  });

  describe('Boundary Conditions', () => {
    it('should enforce minimum duration of 1 second', () => {
      render(<TimelineScrubber {...defaultProps} />);
      const slider = screen.getByRole('slider', { name: /GIF duration/i });

      expect(slider).toHaveAttribute('min', '1');
    });

    it('should enforce maximum duration of 20 seconds for long videos', () => {
      render(<TimelineScrubber {...defaultProps} duration={60} />);
      const slider = screen.getByRole('slider', { name: /GIF duration/i });

      expect(slider).toHaveAttribute('max', '20');
    });

    it('should adapt max duration to video length for short videos', () => {
      render(<TimelineScrubber {...defaultProps} duration={15} startTime={0} />);
      const slider = screen.getByRole('slider', { name: /GIF duration/i });

      expect(slider).toHaveAttribute('max', '15');
    });

    it('should respect video duration limit when slider changes', () => {
      render(<TimelineScrubber {...defaultProps} duration={10} startTime={8} />);
      const slider = screen.getByRole('slider', { name: /GIF duration/i });

      // Try to set duration beyond video end
      fireEvent.change(slider, { target: { value: '5' } });

      // Should be clamped to remaining duration (10 - 8 = 2)
      expect(defaultProps.onRangeChange).toHaveBeenCalledWith(8, 10);
    });

    it('should disable slider for videos shorter than 1 second', () => {
      render(<TimelineScrubber {...defaultProps} duration={0.5} />);
      const slider = screen.getByRole('slider', { name: /GIF duration/i });

      expect(slider).toBeDisabled();
      expect(screen.getByText(/Video too short for GIF creation/i)).toBeInTheDocument();
    });

    it('should adjust max slider value based on current start position', () => {
      render(<TimelineScrubber {...defaultProps} duration={25} startTime={10} />);
      const slider = screen.getByRole('slider', { name: /GIF duration/i });

      // Max should be min(20, 25-10) = 15
      expect(slider).toHaveAttribute('max', '15');
    });
  });

  describe('Integration', () => {
    it('should update slider when timeline handles are dragged', () => {
      const { rerender } = render(<TimelineScrubber {...defaultProps} />);
      const slider = screen.getByRole('slider', { name: /GIF duration/i });

      expect(slider).toHaveValue('5');

      // Simulate dragging end handle
      rerender(<TimelineScrubber {...defaultProps} endTime={8} />);
      expect(slider).toHaveValue('8');

      // Simulate dragging start handle
      rerender(<TimelineScrubber {...defaultProps} startTime={2} endTime={8} />);
      expect(slider).toHaveValue('6');
    });

    it('should preserve start position when slider changes', () => {
      render(<TimelineScrubber {...defaultProps} startTime={3} endTime={8} />);
      const slider = screen.getByRole('slider', { name: /GIF duration/i });

      fireEvent.change(slider, { target: { value: '10' } });

      // Start should remain at 3, end should be 3 + 10 = 13
      expect(defaultProps.onRangeChange).toHaveBeenCalledWith(3, 13);
    });

    it('should handle step value of 0.1 seconds', () => {
      render(<TimelineScrubber {...defaultProps} />);
      const slider = screen.getByRole('slider', { name: /GIF duration/i });

      expect(slider).toHaveAttribute('step', '0.1');

      fireEvent.change(slider, { target: { value: '5.7' } });
      expect(defaultProps.onRangeChange).toHaveBeenCalledWith(0, 5.7);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<TimelineScrubber {...defaultProps} />);
      const slider = screen.getByRole('slider', { name: /GIF duration/i });

      expect(slider).toHaveAttribute('aria-label', 'GIF duration');
      expect(slider).toHaveAttribute('aria-valuemin', '1');
      expect(slider).toHaveAttribute('aria-valuemax', '20');
      expect(slider).toHaveAttribute('aria-valuenow', '5');
    });

    it('should update aria-valuenow when slider changes', () => {
      const { rerender } = render(<TimelineScrubber {...defaultProps} />);
      const slider = screen.getByRole('slider', { name: /GIF duration/i });

      fireEvent.change(slider, { target: { value: '8.5' } });

      rerender(<TimelineScrubber {...defaultProps} endTime={8.5} />);
      expect(slider).toHaveAttribute('aria-valuenow', '8.5');
    });

    it('should have accessible labels', () => {
      const { container } = render(<TimelineScrubber {...defaultProps} />);

      expect(screen.getByText('Clip Duration')).toBeInTheDocument();
      const valueDisplay = container.querySelector('.ytgif-slider-value');
      expect(valueDisplay).toHaveTextContent('5.0s');
    });
  });
});