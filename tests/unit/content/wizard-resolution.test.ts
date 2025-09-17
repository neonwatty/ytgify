import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import QuickCaptureScreen from '@/content/overlay-wizard/screens/QuickCaptureScreen';

describe('QuickCaptureScreen Resolution Options', () => {
  const mockProps = {
    startTime: 0,
    endTime: 10,
    currentTime: 0,
    duration: 100,
    videoElement: undefined,
    onConfirm: jest.fn(),
    onBack: jest.fn(),
    onSeekTo: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render all four resolution options', () => {
    const { container } = render(
      React.createElement(QuickCaptureScreen, mockProps)
    );

    // Check for all resolution buttons
    const resolutionButtons = container.querySelectorAll('.ytgif-resolution-btn');
    expect(resolutionButtons).toHaveLength(4);

    // Check for specific resolution labels
    const buttonTexts = Array.from(resolutionButtons).map(btn => btn.textContent || '');
    expect(buttonTexts.some(text => text.includes('144p Nano'))).toBe(true);
    expect(buttonTexts.some(text => text.includes('240p Mini'))).toBe(true);
    expect(buttonTexts.some(text => text.includes('360p Compact'))).toBe(true);
    expect(buttonTexts.some(text => text.includes('480p HD'))).toBe(true);
  });

  it('should select 360p resolution when clicked', () => {
    const { container } = render(
      React.createElement(QuickCaptureScreen, mockProps)
    );

    // Find and click 360p button
    const resolutionButtons = container.querySelectorAll('.ytgif-resolution-btn');
    const button360p = Array.from(resolutionButtons).find(btn =>
      btn.textContent?.includes('360p')
    ) as HTMLElement;

    expect(button360p).toBeTruthy();
    fireEvent.click(button360p);

    // Check that 360p button has active class
    expect(button360p.classList.contains('ytgif-resolution-btn--active')).toBe(true);
  });

  it('should pass 360p resolution to onConfirm callback', () => {
    const { container } = render(
      React.createElement(QuickCaptureScreen, mockProps)
    );

    // Select 360p resolution
    const resolutionButtons = container.querySelectorAll('.ytgif-resolution-btn');
    const button360p = Array.from(resolutionButtons).find(btn =>
      btn.textContent?.includes('360p')
    ) as HTMLElement;

    fireEvent.click(button360p);

    // Click continue button
    const continueButton = container.querySelector('.ytgif-button-primary') as HTMLElement;
    fireEvent.click(continueButton);

    // Verify onConfirm was called with 360p resolution
    expect(mockProps.onConfirm).toHaveBeenCalledWith(
      mockProps.startTime,
      mockProps.endTime,
      5, // default frame rate
      '360p'
    );
  });

  it('should calculate correct file size estimate for 360p', () => {
    const { container } = render(
      React.createElement(QuickCaptureScreen, mockProps)
    );

    // Select 360p resolution
    const resolutionButtons = container.querySelectorAll('.ytgif-resolution-btn');
    const button360p = Array.from(resolutionButtons).find(btn =>
      btn.textContent?.includes('360p')
    ) as HTMLElement;

    fireEvent.click(button360p);

    // Check file size estimate - look for the MB value specifically
    const infoValues = container.querySelectorAll('.ytgif-info-value');
    const sizeEstimate = Array.from(infoValues).find(el =>
      el.textContent?.includes('MB')
    )?.textContent;

    // With 10 second duration, 5 fps, 360p (0.7 multiplier)
    // Expected: 10 * 5 * 0.05 * 0.7 = 1.75 MB
    expect(sizeEstimate).toContain('1.8MB'); // Rounded value
  });

  it('should have proper resolution order from lowest to highest', () => {
    const { container } = render(
      React.createElement(QuickCaptureScreen, mockProps)
    );

    const resolutionButtons = container.querySelectorAll('.ytgif-resolution-btn');
    const buttonTexts = Array.from(resolutionButtons).map(btn => {
      const text = btn.textContent || '';
      if (text.includes('144p')) return '144p';
      if (text.includes('240p')) return '240p';
      if (text.includes('360p')) return '360p';
      if (text.includes('480p')) return '480p';
      if (text.includes('720p')) return '720p';
      if (text.includes('Original')) return 'original';
      return '';
    });

    expect(buttonTexts).toEqual(['144p', '240p', '360p', '480p']);
  });
});