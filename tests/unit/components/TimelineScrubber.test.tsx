import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TimelineScrubber from '../../../src/content/overlay-wizard/components/TimelineScrubber';

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

    it('should respect video duration limit when slider changes and display actual duration', () => {
      const { container } = render(<TimelineScrubber {...defaultProps} duration={10} startTime={8} />);
      const slider = screen.getByRole('slider', { name: /GIF duration/i });

      // Try to set duration beyond video end
      fireEvent.change(slider, { target: { value: '5' } });

      // Should be clamped to remaining duration (10 - 8 = 2)
      expect(defaultProps.onRangeChange).toHaveBeenCalledWith(8, 10);

      // Verify slider displays actual applied duration (2s), not requested duration (5s)
      const valueDisplay = container.querySelector('.ytgif-slider-value');
      expect(valueDisplay).toHaveTextContent('2.0s');
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

    it('should handle edge case: start time very close to end of short video', () => {
      // Start with a smaller duration first, then test overflow
      const { container } = render(<TimelineScrubber {...defaultProps} duration={5} startTime={4.5} endTime={4.7} />);
      const slider = screen.getByRole('slider', { name: /GIF duration/i });

      // Max should be 0.5 seconds (5 - 4.5)
      expect(slider).toHaveAttribute('max', '0.5');

      // Verify initial slider displays current duration (0.2s)
      let valueDisplay = container.querySelector('.ytgif-slider-value');
      expect(valueDisplay).toHaveTextContent('0.2s');

      // Try to set a long duration (10s) which exceeds both max slider (0.5s) and video end
      fireEvent.change(slider, { target: { value: '10' } });

      // Should be clamped to remaining video duration (0.5s)
      expect(defaultProps.onRangeChange).toHaveBeenCalledWith(4.5, 5);

      // Verify slider displays actual applied duration (0.5s), not requested (10s)
      valueDisplay = container.querySelector('.ytgif-slider-value');
      expect(valueDisplay).toHaveTextContent('0.5s');
    });

    it('should synchronize slider value when timeline handles move start position', () => {
      const { container, rerender } = render(<TimelineScrubber {...defaultProps} duration={10} startTime={2} endTime={7} />);

      // Initial duration: 5s
      let valueDisplay = container.querySelector('.ytgif-slider-value');
      expect(valueDisplay).toHaveTextContent('5.0s');

      // Simulate moving start handle near the end (startTime: 8, endTime: 7 is invalid, so it should adjust)
      rerender(<TimelineScrubber {...defaultProps} duration={10} startTime={8} endTime={10} />);

      // Duration should now be 2s (10 - 8)
      valueDisplay = container.querySelector('.ytgif-slider-value');
      expect(valueDisplay).toHaveTextContent('2.0s');

      // Max slider value should also update
      const slider = screen.getByRole('slider', { name: /GIF duration/i });
      expect(slider).toHaveAttribute('max', '2');
    });

    it('should prevent slider from exceeding remaining video duration on very short videos', () => {
      // Start with a smaller duration, then test increasing it beyond video bounds
      const { container } = render(<TimelineScrubber {...defaultProps} duration={8} startTime={7} endTime={7.5} />);
      const slider = screen.getByRole('slider', { name: /GIF duration/i });

      // Only 1 second remaining from start position
      expect(slider).toHaveAttribute('max', '1');

      // Initial value should be 0.5s
      let valueDisplay = container.querySelector('.ytgif-slider-value');
      expect(valueDisplay).toHaveTextContent('0.5s');

      // Try to drag to a longer duration (5s)
      fireEvent.change(slider, { target: { value: '5' } });

      // Should be clamped to max remaining duration (1s)
      expect(defaultProps.onRangeChange).toHaveBeenCalledWith(7, 8);

      // Verify slider displays actual applied duration (1.0s), not requested (5s)
      valueDisplay = container.querySelector('.ytgif-slider-value');
      expect(valueDisplay).toHaveTextContent('1.0s');
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

      // Should have "Duration" label in timeline controls and "Clip Duration" label in slider
      expect(screen.getByText('Duration')).toBeInTheDocument();
      expect(screen.getByText('Clip Duration')).toBeInTheDocument();
      const valueDisplay = container.querySelector('.ytgif-slider-value');
      expect(valueDisplay).toHaveTextContent('5.0s');
    });
  });

  describe('Start Time Input - Parsing', () => {
    it('should initialize input with formatted start time', () => {
      render(<TimelineScrubber {...defaultProps} startTime={90} duration={120} />);
      const input = screen.getByLabelText('Start time');
      expect(input).toHaveValue('1:30');
    });

    it('should parse MM:SS format correctly', () => {
      render(<TimelineScrubber {...defaultProps} duration={120} />);
      const input = screen.getByLabelText('Start time');

      fireEvent.change(input, { target: { value: '1:30' } });
      fireEvent.blur(input);

      expect(defaultProps.onRangeChange).toHaveBeenCalledWith(90, 95);
    });

    it('should parse MM:SS with leading zeros', () => {
      render(<TimelineScrubber {...defaultProps} duration={120} />);
      const input = screen.getByLabelText('Start time');

      fireEvent.change(input, { target: { value: '01:30' } });
      fireEvent.blur(input);

      expect(defaultProps.onRangeChange).toHaveBeenCalledWith(90, 95);
    });

    it('should parse decimal seconds', () => {
      render(<TimelineScrubber {...defaultProps} duration={120} />);
      const input = screen.getByLabelText('Start time');

      fireEvent.change(input, { target: { value: '90.5' } });
      fireEvent.blur(input);

      expect(defaultProps.onRangeChange).toHaveBeenCalledWith(90.5, 95.5);
    });

    it('should parse integer seconds', () => {
      render(<TimelineScrubber {...defaultProps} />);
      const input = screen.getByLabelText('Start time');

      fireEvent.change(input, { target: { value: '10' } });
      fireEvent.blur(input);

      expect(defaultProps.onRangeChange).toHaveBeenCalledWith(10, 15);
    });

    it('should handle seconds at 59', () => {
      render(<TimelineScrubber {...defaultProps} duration={80} />);
      const input = screen.getByLabelText('Start time');

      fireEvent.change(input, { target: { value: '0:59' } });
      fireEvent.blur(input);

      expect(defaultProps.onRangeChange).toHaveBeenCalledWith(59, 64);
    });

    it('should reject invalid format with colons', () => {
      const { container } = render(<TimelineScrubber {...defaultProps} />);
      const input = screen.getByLabelText('Start time');

      fireEvent.change(input, { target: { value: 'abc' } });
      fireEvent.blur(input);

      const errorMessage = container.querySelector('.ytgif-time-input-error-message');
      expect(errorMessage).toHaveTextContent('Invalid format');
    });

    it('should reject seconds >= 60 in MM:SS format', () => {
      const { container } = render(<TimelineScrubber {...defaultProps} />);
      const input = screen.getByLabelText('Start time');

      fireEvent.change(input, { target: { value: '1:70' } });
      fireEvent.blur(input);

      const errorMessage = container.querySelector('.ytgif-time-input-error-message');
      expect(errorMessage).toHaveTextContent('Invalid format');
    });

    it('should handle empty input gracefully', () => {
      const { container } = render(<TimelineScrubber {...defaultProps} />);
      const input = screen.getByLabelText('Start time');

      fireEvent.change(input, { target: { value: '' } });
      fireEvent.blur(input);

      const errorMessage = container.querySelector('.ytgif-time-input-error-message');
      expect(errorMessage).toHaveTextContent('Invalid format');
    });
  });

  describe('Start Time Input - Validation', () => {
    it('should accept valid start time within bounds', () => {
      render(<TimelineScrubber {...defaultProps} startTime={0} endTime={5} duration={30} />);
      const input = screen.getByLabelText('Start time');

      fireEvent.change(input, { target: { value: '10' } });
      fireEvent.blur(input);

      expect(defaultProps.onRangeChange).toHaveBeenCalledWith(10, 15);
    });

    it('should reject negative start time', () => {
      const { container } = render(<TimelineScrubber {...defaultProps} />);
      const input = screen.getByLabelText('Start time');

      fireEvent.change(input, { target: { value: '-5' } });
      fireEvent.blur(input);

      const errorMessage = container.querySelector('.ytgif-time-input-error-message');
      expect(errorMessage).toHaveTextContent('Start time cannot be negative');
    });

    it('should reject start time that exceeds video duration', () => {
      const { container } = render(
        <TimelineScrubber {...defaultProps} startTime={0} endTime={5} duration={10} />
      );
      const input = screen.getByLabelText('Start time');

      // Duration is 10s, clip is 5s, so max start time is 5
      fireEvent.change(input, { target: { value: '8' } });
      fireEvent.blur(input);

      const errorMessage = container.querySelector('.ytgif-time-input-error-message');
      expect(errorMessage).toHaveTextContent('Must be between 0:00 and');
    });

    it('should show correct max time in error message', () => {
      const { container } = render(
        <TimelineScrubber {...defaultProps} startTime={0} endTime={3} duration={10} />
      );
      const input = screen.getByLabelText('Start time');

      fireEvent.change(input, { target: { value: '8' } });
      fireEvent.blur(input);

      const errorMessage = container.querySelector('.ytgif-time-input-error-message');
      expect(errorMessage).toHaveTextContent('0:07');
    });

    it('should accept start time at zero', () => {
      render(<TimelineScrubber {...defaultProps} startTime={5} endTime={10} />);
      const input = screen.getByLabelText('Start time');

      fireEvent.change(input, { target: { value: '0' } });
      fireEvent.blur(input);

      expect(defaultProps.onRangeChange).toHaveBeenCalledWith(0, 5);
    });

    it('should accept start time at max valid value', () => {
      render(<TimelineScrubber {...defaultProps} startTime={0} endTime={5} duration={30} />);
      const input = screen.getByLabelText('Start time');

      // Max valid start time is 25 (30 - 5)
      fireEvent.change(input, { target: { value: '25' } });
      fireEvent.blur(input);

      expect(defaultProps.onRangeChange).toHaveBeenCalledWith(25, 30);
    });
  });

  describe('Start Time Input - Synchronization', () => {
    it('should update input when scrubber handle dragged', () => {
      const { rerender } = render(<TimelineScrubber {...defaultProps} startTime={0} endTime={5} />);
      const input = screen.getByLabelText('Start time');
      expect(input).toHaveValue('0:00');

      rerender(<TimelineScrubber {...defaultProps} startTime={10} endTime={15} />);
      expect(input).toHaveValue('0:10');
    });

    it('should not update input while user is typing (focused)', () => {
      const { rerender } = render(<TimelineScrubber {...defaultProps} startTime={0} endTime={5} />);
      const input = screen.getByLabelText('Start time');

      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '1:2' } });

      // Try to update via prop change (shouldn't affect focused input)
      rerender(<TimelineScrubber {...defaultProps} startTime={10} endTime={15} />);
      expect(input).toHaveValue('1:2');
    });

    it('should update scrubber when valid input submitted', () => {
      render(<TimelineScrubber {...defaultProps} startTime={0} endTime={5} duration={120} />);
      const input = screen.getByLabelText('Start time');

      fireEvent.change(input, { target: { value: '1:30' } });
      fireEvent.blur(input);

      expect(defaultProps.onRangeChange).toHaveBeenCalledWith(90, 95);
    });

    it('should revert input on invalid input', () => {
      render(<TimelineScrubber {...defaultProps} startTime={10} endTime={15} />);
      const input = screen.getByLabelText('Start time');

      fireEvent.change(input, { target: { value: 'invalid' } });
      fireEvent.blur(input);

      expect(input).toHaveValue('0:10');
    });

    it('should maintain clip duration when changing start time', () => {
      render(<TimelineScrubber {...defaultProps} startTime={0} endTime={5} />);
      const input = screen.getByLabelText('Start time');

      fireEvent.change(input, { target: { value: '10' } });
      fireEvent.blur(input);

      // Start moved to 10, end should be 10 + 5 = 15
      expect(defaultProps.onRangeChange).toHaveBeenCalledWith(10, 15);
    });

    it('should clamp end time to video duration', () => {
      render(<TimelineScrubber {...defaultProps} startTime={0} endTime={3} duration={30} />);
      const input = screen.getByLabelText('Start time');

      fireEvent.change(input, { target: { value: '27' } });
      fireEvent.blur(input);

      // Start at 27, duration is 3, so end should be 27 + 3 = 30
      expect(defaultProps.onRangeChange).toHaveBeenCalledWith(27, 30);
    });
  });

  describe('Start Time Input - Keyboard Controls', () => {
    it('should apply input on Enter key', () => {
      render(<TimelineScrubber {...defaultProps} duration={120} />);
      const input = screen.getByLabelText('Start time');

      fireEvent.change(input, { target: { value: '1:30' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      // Enter key calls blur() in the handler, simulate the blur event
      fireEvent.blur(input);

      expect(defaultProps.onRangeChange).toHaveBeenCalledWith(90, 95);
    });

    it('should revert input on Escape key', () => {
      render(<TimelineScrubber {...defaultProps} startTime={10} endTime={15} />);
      const input = screen.getByLabelText('Start time');

      fireEvent.change(input, { target: { value: '20' } });
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(input).toHaveValue('0:10');
      expect(defaultProps.onRangeChange).not.toHaveBeenCalledWith(20, 25);
    });

    it('should clear error on new input', () => {
      const { container } = render(<TimelineScrubber {...defaultProps} />);
      const input = screen.getByLabelText('Start time');

      // Trigger error
      fireEvent.change(input, { target: { value: 'invalid' } });
      fireEvent.blur(input);
      expect(container.querySelector('.ytgif-time-input-error-message')).toBeInTheDocument();

      // Start typing again
      fireEvent.change(input, { target: { value: '1' } });
      expect(container.querySelector('.ytgif-time-input-error-message')).not.toBeInTheDocument();
    });
  });

  describe('Start Time Input - Error States', () => {
    it('should apply error class to input field', () => {
      render(<TimelineScrubber {...defaultProps} />);
      const input = screen.getByLabelText('Start time');

      fireEvent.change(input, { target: { value: 'invalid' } });
      fireEvent.blur(input);

      expect(input).toHaveClass('error');
    });

    it('should show error message below input', () => {
      const { container } = render(<TimelineScrubber {...defaultProps} />);
      const input = screen.getByLabelText('Start time');

      fireEvent.change(input, { target: { value: 'invalid' } });
      fireEvent.blur(input);

      const errorMessage = container.querySelector('.ytgif-time-input-error-message');
      expect(errorMessage).toBeInTheDocument();
    });

    it('should set aria-invalid when error present', () => {
      render(<TimelineScrubber {...defaultProps} />);
      const input = screen.getByLabelText('Start time');

      fireEvent.change(input, { target: { value: 'invalid' } });
      fireEvent.blur(input);

      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('should set aria-describedby when error present', () => {
      render(<TimelineScrubber {...defaultProps} />);
      const input = screen.getByLabelText('Start time');

      fireEvent.change(input, { target: { value: 'invalid' } });
      fireEvent.blur(input);

      expect(input).toHaveAttribute('aria-describedby', 'ytgif-time-input-error');
    });

    it('should remove error class when valid input entered', () => {
      render(<TimelineScrubber {...defaultProps} />);
      const input = screen.getByLabelText('Start time');

      fireEvent.change(input, { target: { value: 'invalid' } });
      fireEvent.blur(input);
      expect(input).toHaveClass('error');

      fireEvent.change(input, { target: { value: '10' } });
      expect(input).not.toHaveClass('error');
    });
  });
});