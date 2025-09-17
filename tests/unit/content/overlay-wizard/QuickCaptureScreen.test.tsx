import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import QuickCaptureScreen from '@/content/overlay-wizard/screens/QuickCaptureScreen';

describe('QuickCaptureScreen', () => {
  const mockOnConfirm = jest.fn();
  const mockOnBack = jest.fn();
  const mockOnSeekTo = jest.fn();

  const defaultProps = {
    startTime: 10,
    endTime: 20,
    currentTime: 15,
    duration: 60,
    onConfirm: mockOnConfirm,
    onBack: mockOnBack,
    onSeekTo: mockOnSeekTo,
  };

  beforeEach(() => {
    jest.clearAllMocks();
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
});
