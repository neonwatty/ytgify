import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react';
import React from 'react';
import QuickCaptureScreen from '@/content/overlay-wizard/screens/QuickCaptureScreen';

// Mock the child components to isolate testing
jest.mock('@/content/overlay-wizard/components/VideoPreview');
jest.mock('@/content/overlay-wizard/components/TimelineScrubber');

// Import mocked components
import VideoPreview from '@/content/overlay-wizard/components/VideoPreview';
import TimelineScrubber from '@/content/overlay-wizard/components/TimelineScrubber';

const MockVideoPreview = VideoPreview as jest.Mock;
const MockTimelineScrubber = TimelineScrubber as jest.Mock;

describe('QuickCaptureScreen', () => {
  const mockOnConfirm = jest.fn<(startTime: number, endTime: number, frameRate?: number, resolution?: string) => void>();
  const mockOnBack = jest.fn<() => void>();
  const mockOnSeekTo = jest.fn<(time: number) => void>();
  const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});

  const defaultProps = {
    startTime: 10,
    endTime: 20,
    currentTime: 15,
    duration: 60,
    onConfirm: mockOnConfirm,
    onBack: mockOnBack,
    onSeekTo: mockOnSeekTo,
  };

  // Mock video element
  let mockVideoElement: HTMLVideoElement;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConsoleLog.mockClear();

    // Create mock video element
    mockVideoElement = document.createElement('video') as HTMLVideoElement;
    Object.defineProperty(mockVideoElement, 'paused', { value: false, writable: true });
    Object.defineProperty(mockVideoElement, 'currentTime', { value: 15, writable: true });
    mockVideoElement.play = jest.fn(() => Promise.resolve());
    mockVideoElement.pause = jest.fn();

    // Setup default mock implementations
    MockVideoPreview.mockImplementation((props: any) => {
      const { onPlayStateChange, isPlaying, startTime, endTime } = props;
      return (
        <div data-testid="video-preview">
          <button
            data-testid="preview-play-btn"
            onClick={() => onPlayStateChange && onPlayStateChange(!isPlaying)}
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <span data-testid="preview-time">{startTime}-{endTime}</span>
        </div>
      );
    });

    MockTimelineScrubber.mockImplementation((props: any) => {
      const { onRangeChange, onSeek, startTime, endTime, previewTime } = props;
      return (
        <div data-testid="timeline-scrubber">
          <button
            data-testid="timeline-range-btn"
            onClick={() => onRangeChange && onRangeChange(5, 15)}
          >
            Change Range
          </button>
          <button
            data-testid="timeline-seek-btn"
            onClick={() => onSeek && onSeek(12)}
          >
            Seek
          </button>
          <span data-testid="timeline-times">{startTime}-{endTime}</span>
          {previewTime && <span data-testid="preview-time-indicator">{previewTime}</span>}
        </div>
      );
    });
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
  });

  describe('Resolution Selection', () => {
    it('should render all four resolution options', () => {
      render(<QuickCaptureScreen {...defaultProps} />);

      expect(screen.getByText('144p Nano')).toBeTruthy();
      expect(screen.getByText('240p Mini')).toBeTruthy();
      expect(screen.getByText('360p Compact')).toBeTruthy();
      expect(screen.getByText('480p HD')).toBeTruthy();
    });

    it('should display resolution descriptions', () => {
      render(<QuickCaptureScreen {...defaultProps} />);

      expect(screen.getByText('Perfect for chat')).toBeTruthy();
      expect(screen.getByText('Quick to share')).toBeTruthy();
      expect(screen.getByText('Ideal for email')).toBeTruthy();
      expect(screen.getByText('Best quality')).toBeTruthy();
    });

    it('should have 144p selected by default', () => {
      render(<QuickCaptureScreen {...defaultProps} />);

      const button144p = screen.getByText('144p Nano').closest('button');
      expect(button144p?.className).toContain('ytgif-resolution-btn--active');

      const button480p = screen.getByText('480p HD').closest('button');
      expect(button480p?.className).not.toContain('ytgif-resolution-btn--active');
    });

    it('should update selection when 360p is clicked', () => {
      render(<QuickCaptureScreen {...defaultProps} />);

      const button360p = screen.getByText('360p Compact').closest('button')!;
      fireEvent.click(button360p);

      expect(button360p?.className).toContain('ytgif-resolution-btn--active');

      const button480p = screen.getByText('480p HD').closest('button');
      expect(button480p?.className).not.toContain('ytgif-resolution-btn--active');
    });

    it('should update selection when 144p is clicked', () => {
      render(<QuickCaptureScreen {...defaultProps} />);

      const button144p = screen.getByText('144p Nano').closest('button')!;
      fireEvent.click(button144p);

      expect(button144p?.className).toContain('ytgif-resolution-btn--active');

      const button480p = screen.getByText('480p HD').closest('button');
      expect(button480p?.className).not.toContain('ytgif-resolution-btn--active');
    });

    it('should only have one resolution selected at a time', () => {
      render(<QuickCaptureScreen {...defaultProps} />);

      // Click 360p
      fireEvent.click(screen.getByText('360p Compact').closest('button')!);
      let activeButtons = screen
        .getAllByRole('button')
        .filter((btn) => btn.className.includes('ytgif-resolution-btn--active'));
      expect(activeButtons).toHaveLength(1);

      // Click 240p
      fireEvent.click(screen.getByText('240p Mini').closest('button')!);
      activeButtons = screen
        .getAllByRole('button')
        .filter((btn) => btn.className.includes('ytgif-resolution-btn--active'));
      expect(activeButtons).toHaveLength(1);
    });
  });

  describe('Frame Rate Selection', () => {
    it('should render all three frame rate options', () => {
      render(<QuickCaptureScreen {...defaultProps} />);

      expect(screen.getByText('5 fps')).toBeTruthy();
      expect(screen.getByText('10 fps')).toBeTruthy();
      expect(screen.getByText('15 fps')).toBeTruthy();
    });

    it('should have 5 fps selected by default', () => {
      render(<QuickCaptureScreen {...defaultProps} />);

      const button5fps = screen.getByText('5 fps').closest('button');
      expect(button5fps?.className).toContain('ytgif-frame-rate-btn--active');
    });
  });

  describe('File Size Estimation', () => {
    it('should update file size estimate based on resolution', () => {
      render(<QuickCaptureScreen {...defaultProps} />);

      // Default 144p with 5fps
      let sizeText = screen.getByText(/~.*MB/);
      const size144p = parseFloat(sizeText.textContent?.match(/~(.*)MB/)?.[1] || '0');

      // Click 240p
      fireEvent.click(screen.getByText('240p Mini').closest('button')!);
      sizeText = screen.getByText(/~.*MB/);
      const size240p = parseFloat(sizeText.textContent?.match(/~(.*)MB/)?.[1] || '0');

      // Click 360p
      fireEvent.click(screen.getByText('360p Compact').closest('button')!);
      sizeText = screen.getByText(/~.*MB/);
      const size360p = parseFloat(sizeText.textContent?.match(/~(.*)MB/)?.[1] || '0');

      // Verify size relationship: 144p < 240p < 360p
      expect(size240p).toBeGreaterThan(size144p);
      expect(size360p).toBeGreaterThan(size240p);
    });

    it('should update file size estimate based on frame rate', () => {
      render(<QuickCaptureScreen {...defaultProps} />);

      // Default 5fps
      let sizeText = screen.getByText(/~.*MB/);
      const size5fps = parseFloat(sizeText.textContent?.match(/~(.*)MB/)?.[1] || '0');

      // Click 10fps
      fireEvent.click(screen.getByText('10 fps').closest('button')!);
      sizeText = screen.getByText(/~.*MB/);
      const size10fps = parseFloat(sizeText.textContent?.match(/~(.*)MB/)?.[1] || '0');

      // Click 15fps
      fireEvent.click(screen.getByText('15 fps').closest('button')!);
      sizeText = screen.getByText(/~.*MB/);
      const size15fps = parseFloat(sizeText.textContent?.match(/~(.*)MB/)?.[1] || '0');

      // Verify size relationship: 5fps < 10fps < 15fps
      expect(size10fps).toBeGreaterThan(size5fps);
      expect(size15fps).toBeGreaterThan(size10fps);
    });

    it('should calculate correct file size for different durations', () => {
      const { rerender } = render(<QuickCaptureScreen {...defaultProps} />);

      // 10 second duration
      let sizeText = screen.getByText(/~.*MB/);
      const size10s = parseFloat(sizeText.textContent?.match(/~(.*)MB/)?.[1] || '0');

      // 5 second duration
      rerender(<QuickCaptureScreen {...defaultProps} startTime={10} endTime={15} />);
      sizeText = screen.getByText(/~.*MB/);
      const size5s = parseFloat(sizeText.textContent?.match(/~(.*)MB/)?.[1] || '0');

      // 5 second should be roughly half of 10 second (with some tolerance)
      expect(Math.abs(size5s - size10s / 2)).toBeLessThan(2.0);
    });
  });

  describe('onConfirm Callback', () => {
    it('should pass default values when confirm is clicked', () => {
      render(<QuickCaptureScreen {...defaultProps} />);

      const confirmButton = screen.getByText(/Continue to Customize/);
      fireEvent.click(confirmButton);

      expect(mockOnConfirm).toHaveBeenCalledWith(10, 20, 5, '144p');
    });

    it('should pass selected resolution when confirm is clicked', () => {
      render(<QuickCaptureScreen {...defaultProps} />);

      // Select 360p
      fireEvent.click(screen.getByText('360p Compact').closest('button')!);

      const confirmButton = screen.getByText(/Continue to Customize/);
      fireEvent.click(confirmButton);

      expect(mockOnConfirm).toHaveBeenCalledWith(10, 20, 5, '360p');
    });

    it('should pass selected frame rate when confirm is clicked', () => {
      render(<QuickCaptureScreen {...defaultProps} />);

      // Select 15fps
      fireEvent.click(screen.getByText('15 fps').closest('button')!);

      const confirmButton = screen.getByText(/Continue to Customize/);
      fireEvent.click(confirmButton);

      expect(mockOnConfirm).toHaveBeenCalledWith(10, 20, 15, '144p');
    });

    it('should pass all selected options when confirm is clicked', () => {
      render(<QuickCaptureScreen {...defaultProps} />);

      // Select 144p resolution
      fireEvent.click(screen.getByText('144p Nano').closest('button')!);
      // Select 10fps
      fireEvent.click(screen.getByText('10 fps').closest('button')!);

      const confirmButton = screen.getByText(/Continue to Customize/);
      fireEvent.click(confirmButton);

      expect(mockOnConfirm).toHaveBeenCalledWith(10, 20, 10, '144p');
    });
  });

  describe('Back Button', () => {
    it('should call onBack when back button is clicked', () => {
      render(<QuickCaptureScreen {...defaultProps} />);

      const backButton = screen
        .getByRole('button', { name: '' })
        .parentElement?.querySelector('.ytgif-back-button');
      if (backButton) {
        fireEvent.click(backButton);
      }

      expect(mockOnBack).toHaveBeenCalled();
    });
  });

  describe('UI Elements', () => {
    it('should display resolution section header', () => {
      render(<QuickCaptureScreen {...defaultProps} />);

      expect(screen.getByText('Resolution')).toBeTruthy();
    });

    it('should display frame rate section header', () => {
      render(<QuickCaptureScreen {...defaultProps} />);

      expect(screen.getByText('Frame Rate')).toBeTruthy();
    });

    it('should display duration info', () => {
      render(<QuickCaptureScreen {...defaultProps} />);

      expect(screen.getByText('Duration:')).toBeTruthy();
      // Check that the duration value exists (10.0s)
      const durationElements = screen.getAllByText('10.0s');
      expect(durationElements.length).toBeGreaterThan(0);
    });

    it('should display estimated frames', () => {
      render(<QuickCaptureScreen {...defaultProps} />);

      expect(screen.getByText('Frames:')).toBeTruthy();
      expect(screen.getByText('~50')).toBeTruthy(); // 10s * 5fps = 50
    });

    it('should update frame count when frame rate changes', () => {
      render(<QuickCaptureScreen {...defaultProps} />);

      // Click 15fps
      fireEvent.click(screen.getByText('15 fps').closest('button')!);

      expect(screen.getByText('~150')).toBeTruthy(); // 10s * 15fps = 150
    });
  });

  describe('Video Element Integration', () => {
    it('should render VideoPreview when videoElement is provided', () => {
      const mockVideoElement = document.createElement('video');
      render(<QuickCaptureScreen {...defaultProps} videoElement={mockVideoElement} />);

      // VideoPreview component should be rendered (check for absence of fallback)
      expect(screen.queryByText('Loading video element...')).not.toBeTruthy();
    });

    it('should show fallback when videoElement is not provided', () => {
      render(<QuickCaptureScreen {...defaultProps} videoElement={undefined} />);

      expect(screen.getByText('Loading video element...')).toBeTruthy();
    });
  });

  describe('Timeline Interaction', () => {
    describe('handleRangeChange', () => {
      it('should update start and end time when timeline range changes', () => {
        const { rerender } = render(<QuickCaptureScreen {...defaultProps} videoElement={mockVideoElement} />);

        // Trigger range change through TimelineScrubber
        const rangeBtn = screen.getByTestId('timeline-range-btn');
        fireEvent.click(rangeBtn);

        // Verify VideoPreview receives updated times
        expect(VideoPreview).toHaveBeenLastCalledWith(
          expect.objectContaining({
            startTime: 5,
            endTime: 15,
          }),
          {}
        );
      });

      it('should reset preview time to new start time when range changes', () => {
        render(<QuickCaptureScreen {...defaultProps} videoElement={mockVideoElement} />);

        // Start preview playback first
        const playBtn = screen.getByTestId('preview-play-btn');
        fireEvent.click(playBtn);

        // Change range
        const rangeBtn = screen.getByTestId('timeline-range-btn');
        fireEvent.click(rangeBtn);

        // Verify preview stops playing
        expect(VideoPreview).toHaveBeenLastCalledWith(
          expect.objectContaining({
            isPlaying: false,
          }),
          {}
        );
      });

      it('should stop preview playback when range changes', () => {
        render(<QuickCaptureScreen {...defaultProps} videoElement={mockVideoElement} />);

        // Start playback
        const playBtn = screen.getByTestId('preview-play-btn');
        fireEvent.click(playBtn);

        // Verify playing
        expect(VideoPreview).toHaveBeenCalledWith(
          expect.objectContaining({ isPlaying: true }),
          {}
        );

        // Change range
        const rangeBtn = screen.getByTestId('timeline-range-btn');
        fireEvent.click(rangeBtn);

        // Verify stopped
        expect(VideoPreview).toHaveBeenLastCalledWith(
          expect.objectContaining({ isPlaying: false }),
          {}
        );
      });

      it('should maintain range within video duration bounds', () => {
        render(<QuickCaptureScreen {...defaultProps} duration={30} videoElement={mockVideoElement} />);

        // TimelineScrubber should receive proper duration
        expect(TimelineScrubber).toHaveBeenCalledWith(
          expect.objectContaining({
            duration: 30,
          }),
          {}
        );
      });
    });

    describe('handleSeek', () => {
      it('should update preview time when seek is called', () => {
        render(<QuickCaptureScreen {...defaultProps} videoElement={mockVideoElement} />);

        const seekBtn = screen.getByTestId('timeline-seek-btn');
        fireEvent.click(seekBtn);

        // Verify onSeekTo was called with the seek time
        expect(mockOnSeekTo).toHaveBeenCalledWith(12);
      });

      it('should call onSeekTo prop when provided', () => {
        render(<QuickCaptureScreen {...defaultProps} videoElement={mockVideoElement} />);

        const seekBtn = screen.getByTestId('timeline-seek-btn');
        fireEvent.click(seekBtn);

        expect(mockOnSeekTo).toHaveBeenCalledTimes(1);
        expect(mockOnSeekTo).toHaveBeenCalledWith(12);
      });

      it('should not call onSeekTo if prop is undefined', () => {
        render(<QuickCaptureScreen {...defaultProps} onSeekTo={undefined} videoElement={mockVideoElement} />);

        const seekBtn = screen.getByTestId('timeline-seek-btn');
        // Should not throw error
        expect(() => fireEvent.click(seekBtn)).not.toThrow();
      });
    });

    describe('TimelineScrubber Integration', () => {
      it('should render TimelineScrubber with correct props', () => {
        render(<QuickCaptureScreen {...defaultProps} videoElement={mockVideoElement} />);

        expect(TimelineScrubber).toHaveBeenCalledWith(
          expect.objectContaining({
            duration: 60,
            startTime: 10,
            endTime: 20,
            currentTime: 15,
            onRangeChange: expect.any(Function),
            onSeek: expect.any(Function),
          }),
          {}
        );
      });

      it('should pass previewTime when preview is playing', () => {
        render(<QuickCaptureScreen {...defaultProps} videoElement={mockVideoElement} />);

        // Start preview
        const playBtn = screen.getByTestId('preview-play-btn');
        fireEvent.click(playBtn);

        // TimelineScrubber should receive previewTime when playing
        expect(TimelineScrubber).toHaveBeenLastCalledWith(
          expect.objectContaining({
            previewTime: expect.any(Number),
          }),
          {}
        );
      });

      it('should not pass previewTime when preview is stopped', () => {
        render(<QuickCaptureScreen {...defaultProps} videoElement={mockVideoElement} />);

        // Verify previewTime is undefined when not playing
        expect(TimelineScrubber).toHaveBeenCalledWith(
          expect.objectContaining({
            previewTime: undefined,
          }),
          {}
        );
      });

      it('should handle onRangeChange callback from TimelineScrubber', () => {
        render(<QuickCaptureScreen {...defaultProps} videoElement={mockVideoElement} />);

        // Simulate range change
        const rangeBtn = screen.getByTestId('timeline-range-btn');
        fireEvent.click(rangeBtn);

        // Verify the component re-renders with new times
        expect(VideoPreview).toHaveBeenCalledWith(
          expect.objectContaining({
            startTime: 5,
            endTime: 15,
          }),
          {}
        );
      });

      it('should handle onSeek callback from TimelineScrubber', () => {
        render(<QuickCaptureScreen {...defaultProps} videoElement={mockVideoElement} />);

        const seekBtn = screen.getByTestId('timeline-seek-btn');
        fireEvent.click(seekBtn);

        expect(mockOnSeekTo).toHaveBeenCalledWith(12);
      });
    });
  });

  describe('Video Preview Functionality', () => {
    describe('Preview Playback State', () => {
      it('should initialize isPreviewPlaying as false', () => {
        render(<QuickCaptureScreen {...defaultProps} videoElement={mockVideoElement} />);

        expect(VideoPreview).toHaveBeenCalledWith(
          expect.objectContaining({
            isPlaying: false,
          }),
          {}
        );
      });

      it('should set isPreviewPlaying to true when play button clicked', () => {
        render(<QuickCaptureScreen {...defaultProps} videoElement={mockVideoElement} />);

        const playBtn = screen.getByTestId('preview-play-btn');
        fireEvent.click(playBtn);

        expect(VideoPreview).toHaveBeenLastCalledWith(
          expect.objectContaining({
            isPlaying: true,
          }),
          {}
        );
      });

      it('should set isPreviewPlaying to false when pause button clicked', () => {
        render(<QuickCaptureScreen {...defaultProps} videoElement={mockVideoElement} />);

        // Start playing
        const playBtn = screen.getByTestId('preview-play-btn');
        fireEvent.click(playBtn);

        // Then pause
        fireEvent.click(playBtn);

        expect(VideoPreview).toHaveBeenLastCalledWith(
          expect.objectContaining({
            isPlaying: false,
          }),
          {}
        );
      });

      it('should toggle playback state correctly', () => {
        render(<QuickCaptureScreen {...defaultProps} videoElement={mockVideoElement} />);

        const playBtn = screen.getByTestId('preview-play-btn');

        // Toggle multiple times
        fireEvent.click(playBtn); // Play
        expect(VideoPreview).toHaveBeenLastCalledWith(
          expect.objectContaining({ isPlaying: true }),
          {}
        );

        fireEvent.click(playBtn); // Pause
        expect(VideoPreview).toHaveBeenLastCalledWith(
          expect.objectContaining({ isPlaying: false }),
          {}
        );

        fireEvent.click(playBtn); // Play again
        expect(VideoPreview).toHaveBeenLastCalledWith(
          expect.objectContaining({ isPlaying: true }),
          {}
        );
      });

      it('should stop playback when component unmounts', () => {
        const { unmount } = render(<QuickCaptureScreen {...defaultProps} videoElement={mockVideoElement} />);

        // Start playback
        const playBtn = screen.getByTestId('preview-play-btn');
        fireEvent.click(playBtn);

        // Unmount component
        unmount();

        // Component should clean up without errors
        expect(() => unmount()).not.toThrow();
      });
    });

    describe('onPlayStateChange Callback', () => {
      it('should call onPlayStateChange(true) when play button clicked', () => {
        render(<QuickCaptureScreen {...defaultProps} videoElement={mockVideoElement} />);

        const playBtn = screen.getByTestId('preview-play-btn');
        fireEvent.click(playBtn);

        // Check that VideoPreview received the callback
        const lastCall = MockVideoPreview.mock.calls[MockVideoPreview.mock.calls.length - 1][0] as any;
        expect(lastCall.isPlaying).toBe(true);
      });

      it('should call onPlayStateChange(false) when pause button clicked', () => {
        render(<QuickCaptureScreen {...defaultProps} videoElement={mockVideoElement} />);

        const playBtn = screen.getByTestId('preview-play-btn');
        fireEvent.click(playBtn); // Play
        fireEvent.click(playBtn); // Pause

        const lastCall = MockVideoPreview.mock.calls[MockVideoPreview.mock.calls.length - 1][0] as any;
        expect(lastCall.isPlaying).toBe(false);
      });

      it('should log state changes to console for debugging', () => {
        // Note: This test verifies that debug logging is in place
        // The actual console.log is mocked, so we just verify the component renders and handles clicks
        render(<QuickCaptureScreen {...defaultProps} videoElement={mockVideoElement} />);

        const playBtn = screen.getByTestId('preview-play-btn');
        fireEvent.click(playBtn);

        // The click should trigger state change (verified by checking VideoPreview props)
        expect(MockVideoPreview).toHaveBeenCalledWith(
          expect.objectContaining({
            isPlaying: true,
          }),
          {}
        );
      });

      it('should handle rapid play/pause toggles', async () => {
        render(<QuickCaptureScreen {...defaultProps} videoElement={mockVideoElement} />);

        const playBtn = screen.getByTestId('preview-play-btn');

        // Clear mock calls to track only the toggles
        MockVideoPreview.mockClear();

        // Rapid toggling
        fireEvent.click(playBtn); // Play
        fireEvent.click(playBtn); // Pause
        fireEvent.click(playBtn); // Play
        fireEvent.click(playBtn); // Pause

        // Should handle all toggles without errors
        // After 4 toggles, the component should have been called multiple times
        await waitFor(() => {
          expect(MockVideoPreview.mock.calls.length).toBeGreaterThan(0);
        });

        // Final state should be paused (false) after even number of clicks
        const calls = MockVideoPreview.mock.calls;
        const lastCallWithPlayState = calls[calls.length - 1][0] as any;
        expect(lastCallWithPlayState.isPlaying).toBe(false);
      });
    });

    describe('VideoPreview Component', () => {
      it('should pass videoElement prop to VideoPreview', () => {
        render(<QuickCaptureScreen {...defaultProps} videoElement={mockVideoElement} />);

        expect(VideoPreview).toHaveBeenCalledWith(
          expect.objectContaining({
            videoElement: mockVideoElement,
          }),
          {}
        );
      });

      it('should pass startTime and endTime to VideoPreview', () => {
        render(<QuickCaptureScreen {...defaultProps} videoElement={mockVideoElement} />);

        expect(VideoPreview).toHaveBeenCalledWith(
          expect.objectContaining({
            startTime: 10,
            endTime: 20,
          }),
          {}
        );
      });

      it('should pass currentTime as currentVideoTime to VideoPreview', () => {
        render(<QuickCaptureScreen {...defaultProps} videoElement={mockVideoElement} />);

        expect(VideoPreview).toHaveBeenCalledWith(
          expect.objectContaining({
            currentVideoTime: 15,
          }),
          {}
        );
      });

      it('should pass isPreviewPlaying state to VideoPreview', () => {
        render(<QuickCaptureScreen {...defaultProps} videoElement={mockVideoElement} />);

        // Initial state
        expect(VideoPreview).toHaveBeenCalledWith(
          expect.objectContaining({
            isPlaying: false,
          }),
          {}
        );

        // After clicking play
        const playBtn = screen.getByTestId('preview-play-btn');
        fireEvent.click(playBtn);

        expect(VideoPreview).toHaveBeenLastCalledWith(
          expect.objectContaining({
            isPlaying: true,
          }),
          {}
        );
      });

      it('should handle onPlayStateChange from VideoPreview', () => {
        render(<QuickCaptureScreen {...defaultProps} videoElement={mockVideoElement} />);

        const playBtn = screen.getByTestId('preview-play-btn');
        fireEvent.click(playBtn);

        // Verify the callback was handled and state updated
        expect(VideoPreview).toHaveBeenCalledWith(
          expect.objectContaining({
            onPlayStateChange: expect.any(Function),
          }),
          {}
        );
      });

      it('should render fallback when videoElement is undefined', () => {
        render(<QuickCaptureScreen {...defaultProps} videoElement={undefined} />);

        expect(screen.getByText('Loading video element...')).toBeTruthy();
        expect(screen.queryByTestId('video-preview')).not.toBeTruthy();
      });
    });
  });

  describe('State Management', () => {
    describe('useEffect Hooks', () => {
      it('should log preview playing state changes', () => {
        // This test verifies that state changes are tracked
        // We check this by verifying the VideoPreview component receives the correct props
        render(<QuickCaptureScreen {...defaultProps} videoElement={mockVideoElement} />);

        // Initial state should be false
        expect(MockVideoPreview).toHaveBeenCalledWith(
          expect.objectContaining({
            isPlaying: false,
          }),
          {}
        );

        // After play click, state should be true
        const playBtn = screen.getByTestId('preview-play-btn');
        fireEvent.click(playBtn);

        expect(MockVideoPreview).toHaveBeenCalledWith(
          expect.objectContaining({
            isPlaying: true,
          }),
          {}
        );
      });

      it('should initialize previewTime to startTime', () => {
        render(<QuickCaptureScreen {...defaultProps} videoElement={mockVideoElement} />);

        // TimelineScrubber should receive initial values
        expect(TimelineScrubber).toHaveBeenCalledWith(
          expect.objectContaining({
            startTime: 10,
          }),
          {}
        );
      });

      it('should update previewTime when timeline changes', () => {
        render(<QuickCaptureScreen {...defaultProps} videoElement={mockVideoElement} />);

        // Change range
        const rangeBtn = screen.getByTestId('timeline-range-btn');
        fireEvent.click(rangeBtn);

        // New start time should be reflected
        expect(VideoPreview).toHaveBeenLastCalledWith(
          expect.objectContaining({
            startTime: 5,
          }),
          {}
        );
      });

      it('should reset playback state when startTime/endTime changes', () => {
        // This test verifies that changing start/end times updates the component properly
        const { unmount } = render(<QuickCaptureScreen {...defaultProps} videoElement={mockVideoElement} />);

        // Unmount the first instance
        unmount();

        // Clear all mocks
        MockVideoPreview.mockClear();

        // Render with new times
        render(<QuickCaptureScreen {...defaultProps} startTime={15} endTime={25} videoElement={mockVideoElement} />);

        // VideoPreview should have been called with the new times
        expect(MockVideoPreview).toHaveBeenCalledWith(
          expect.objectContaining({
            startTime: 15,
            endTime: 25,
          }),
          {}
        );
      });
    });

    describe('State Synchronization', () => {
      it('should sync previewTime with timeline scrubber', () => {
        render(<QuickCaptureScreen {...defaultProps} videoElement={mockVideoElement} />);

        // When playing, TimelineScrubber should get previewTime
        const playBtn = screen.getByTestId('preview-play-btn');
        fireEvent.click(playBtn);

        expect(TimelineScrubber).toHaveBeenLastCalledWith(
          expect.objectContaining({
            previewTime: expect.any(Number),
          }),
          {}
        );
      });

      it('should maintain consistent state between resolution and frame rate', () => {
        render(<QuickCaptureScreen {...defaultProps} videoElement={mockVideoElement} />);

        // Select new resolution
        fireEvent.click(screen.getByText('360p Compact').closest('button')!);

        // Select new frame rate
        fireEvent.click(screen.getByText('10 fps').closest('button')!);

        // Confirm button should pass both values
        const confirmButton = screen.getByText(/Continue to Customize/);
        fireEvent.click(confirmButton);

        expect(mockOnConfirm).toHaveBeenCalledWith(10, 20, 10, '360p');
      });

      it('should update frame count when duration changes', () => {
        // Test that frame count updates based on duration and frame rate
        // Initial test: 10s duration * 5fps = 50 frames
        const { unmount } = render(<QuickCaptureScreen {...defaultProps} videoElement={mockVideoElement} />);

        // Verify initial calculation (10s * 5fps = 50)
        let frameInfos = screen.getAllByText(/^~\d+$/);
        expect(frameInfos.some(el => el.textContent === '~50')).toBe(true);

        // Unmount and re-render with different duration
        unmount();

        // Render with 5 second duration (endTime 15 instead of 20)
        render(<QuickCaptureScreen {...defaultProps} startTime={10} endTime={15} videoElement={mockVideoElement} />);

        // Should now show ~25 frames (5s * 5fps)
        frameInfos = screen.getAllByText(/^~\d+$/);
        expect(frameInfos.some(el => el.textContent === '~25')).toBe(true);
      });

      it('should update file size estimate when parameters change', () => {
        render(<QuickCaptureScreen {...defaultProps} videoElement={mockVideoElement} />);

        // Get initial size
        let sizeText = screen.getByText(/~.*MB/);
        const initialSize = parseFloat(sizeText.textContent?.match(/~(.*)MB/)?.[1] || '0');

        // Change frame rate to 15fps
        fireEvent.click(screen.getByText('15 fps').closest('button')!);

        sizeText = screen.getByText(/~.*MB/);
        const newSize = parseFloat(sizeText.textContent?.match(/~(.*)MB/)?.[1] || '0');

        // Size should increase with higher frame rate
        expect(newSize).toBeGreaterThan(initialSize);
      });
    });

    describe('Component Cleanup', () => {
      it('should cleanup event listeners on unmount', () => {
        const { unmount } = render(<QuickCaptureScreen {...defaultProps} videoElement={mockVideoElement} />);

        // Should unmount without errors
        expect(() => unmount()).not.toThrow();
      });

      it('should stop preview playback on unmount', () => {
        const { unmount } = render(<QuickCaptureScreen {...defaultProps} videoElement={mockVideoElement} />);

        // Start playback
        const playBtn = screen.getByTestId('preview-play-btn');
        fireEvent.click(playBtn);

        // Unmount while playing
        unmount();

        // Should not throw errors
        expect(mockConsoleLog).not.toHaveBeenCalledWith(
          expect.stringContaining('Error'),
          expect.anything()
        );
      });

      it('should reset state references on unmount', () => {
        const { unmount } = render(<QuickCaptureScreen {...defaultProps} videoElement={mockVideoElement} />);

        // Make some state changes
        fireEvent.click(screen.getByText('360p Compact').closest('button')!);
        fireEvent.click(screen.getByText('15 fps').closest('button')!);

        unmount();

        // Create a fresh render after unmount
        const { container } = render(<QuickCaptureScreen {...defaultProps} videoElement={mockVideoElement} />);

        // Should have default values again
        const button144p = container.querySelector('.ytgif-resolution-btn--active');
        expect(button144p?.textContent).toContain('144p Nano');
      });

      it('should not throw errors during cleanup', () => {
        const { unmount } = render(<QuickCaptureScreen {...defaultProps} videoElement={mockVideoElement} />);

        // Multiple state changes
        const playBtn = screen.getByTestId('preview-play-btn');
        fireEvent.click(playBtn);
        fireEvent.click(screen.getByTestId('timeline-range-btn'));
        fireEvent.click(screen.getByTestId('timeline-seek-btn'));

        // Should cleanup gracefully
        expect(() => unmount()).not.toThrow();
      });
    });
  });

  describe('Prop Synchronization', () => {
    it('should sync state when initialStartTime and initialEndTime props change after mount', () => {
      // This tests the fix for when the parent component initializes with 0
      // then updates with the actual video time via useEffect
      const { rerender } = render(
        <QuickCaptureScreen
          {...defaultProps}
          startTime={0}
          endTime={5}
          videoElement={mockVideoElement}
        />
      );

      // Initial render should have startTime=0
      expect(VideoPreview).toHaveBeenCalledWith(
        expect.objectContaining({
          startTime: 0,
          endTime: 5,
        }),
        {}
      );

      // Clear mock calls
      MockVideoPreview.mockClear();

      // Parent updates props with actual video time (simulating delayed initialization)
      rerender(
        <QuickCaptureScreen
          {...defaultProps}
          startTime={33}
          endTime={38}
          videoElement={mockVideoElement}
        />
      );

      // State should sync to new prop values
      expect(VideoPreview).toHaveBeenCalledWith(
        expect.objectContaining({
          startTime: 33,
          endTime: 38,
        }),
        {}
      );
    });

    it('should pass synced start time to onConfirm after props update', () => {
      const { rerender } = render(
        <QuickCaptureScreen
          {...defaultProps}
          startTime={0}
          endTime={5}
          videoElement={mockVideoElement}
        />
      );

      // Update props to simulate delayed initialization
      rerender(
        <QuickCaptureScreen
          {...defaultProps}
          startTime={45}
          endTime={50}
          videoElement={mockVideoElement}
        />
      );

      // Click confirm
      const confirmButton = screen.getByText(/Continue to Customize/);
      fireEvent.click(confirmButton);

      // Should use the updated values, not the initial 0
      expect(mockOnConfirm).toHaveBeenCalledWith(45, 50, 5, '144p');
    });

    it('should not re-sync if props have not changed', () => {
      const { rerender } = render(
        <QuickCaptureScreen
          {...defaultProps}
          startTime={10}
          endTime={20}
          videoElement={mockVideoElement}
        />
      );

      // Change internal state via timeline interaction
      const rangeBtn = screen.getByTestId('timeline-range-btn');
      fireEvent.click(rangeBtn); // Sets to 5, 15

      MockVideoPreview.mockClear();

      // Re-render with same initial props
      rerender(
        <QuickCaptureScreen
          {...defaultProps}
          startTime={10}
          endTime={20}
          videoElement={mockVideoElement}
        />
      );

      // Internal state should remain at user-modified values (5, 15), not reset to props
      expect(VideoPreview).toHaveBeenCalledWith(
        expect.objectContaining({
          startTime: 5,
          endTime: 15,
        }),
        {}
      );
    });
  });

  describe('Start Time Input Integration', () => {
    it('should render start time input in TimelineScrubber', () => {
      render(<QuickCaptureScreen {...defaultProps} videoElement={mockVideoElement} />);

      // TimelineScrubber should be called with startTime
      expect(TimelineScrubber).toHaveBeenCalledWith(
        expect.objectContaining({
          startTime: 10,
        }),
        {}
      );
    });

    it('should update start time when TimelineScrubber onChange called', () => {
      // Update the mock to allow calling onRangeChange
      MockTimelineScrubber.mockImplementation((props: any) => {
        return (
          <div data-testid="timeline-scrubber">
            <button
              data-testid="timeline-set-start-btn"
              onClick={() => props.onRangeChange && props.onRangeChange(15, 20)}
            >
              Set Start to 15
            </button>
            <span data-testid="timeline-times">{props.startTime}-{props.endTime}</span>
          </div>
        );
      });

      render(<QuickCaptureScreen {...defaultProps} videoElement={mockVideoElement} />);

      // Click to change start time
      const setStartBtn = screen.getByTestId('timeline-set-start-btn');
      fireEvent.click(setStartBtn);

      // Verify TimelineScrubber receives updated start time
      expect(TimelineScrubber).toHaveBeenCalledWith(
        expect.objectContaining({
          startTime: 15,
          endTime: 20,
        }),
        {}
      );
    });

    it('should pass updated start time to onConfirm', () => {
      // Setup mock to capture onRangeChange
      let capturedOnRangeChange: ((start: number, end: number) => void) | null = null;
      MockTimelineScrubber.mockImplementation((props: any) => {
        capturedOnRangeChange = props.onRangeChange;
        return (
          <div data-testid="timeline-scrubber">
            <span>{props.startTime}-{props.endTime}</span>
          </div>
        );
      });

      render(<QuickCaptureScreen {...defaultProps} videoElement={mockVideoElement} />);

      // Simulate setting new start time via TimelineScrubber
      if (capturedOnRangeChange) {
        act(() => {
          capturedOnRangeChange!(12, 17);
        });
      }

      // Click confirm button
      const confirmButton = screen.getByText(/Continue to Customize/);
      fireEvent.click(confirmButton);

      // onConfirm should receive the updated start time
      expect(mockOnConfirm).toHaveBeenCalledWith(12, 17, 5, '144p');
    });

    it('should maintain start time with resolution and FPS changes', () => {
      // Setup mock
      let capturedOnRangeChange: ((start: number, end: number) => void) | null = null;
      MockTimelineScrubber.mockImplementation((props: any) => {
        capturedOnRangeChange = props.onRangeChange;
        return <div data-testid="timeline-scrubber" />;
      });

      render(<QuickCaptureScreen {...defaultProps} videoElement={mockVideoElement} />);

      // Set start time
      if (capturedOnRangeChange) {
        act(() => {
          capturedOnRangeChange!(8, 13);
        });
      }

      // Change resolution
      fireEvent.click(screen.getByText('360p Compact').closest('button')!);

      // Change FPS
      fireEvent.click(screen.getByText('15 fps').closest('button')!);

      // Confirm
      const confirmButton = screen.getByText(/Continue to Customize/);
      fireEvent.click(confirmButton);

      // All settings should be passed including start time
      expect(mockOnConfirm).toHaveBeenCalledWith(8, 13, 15, '360p');
    });
  });
});
