import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import {
  PreviewControls,
  ControlButton,
  SpeedControl,
  QualityControl,
  FrameRateControl,
  ResolutionControl
} from '@/editor/preview-controls';
import type { GifSettings } from '@/types';

// Mock utils
jest.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' ')
}));

describe('PreviewControls', () => {
  let mockOnPlayPause: jest.Mock;
  let mockOnSeek: jest.Mock;
  let mockOnReset: jest.Mock;
  let mockOnExport: jest.Mock;

  beforeEach(() => {
    mockOnPlayPause = jest.fn();
    mockOnSeek = jest.fn();
    mockOnReset = jest.fn();
    mockOnExport = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render play button when paused', () => {
      render(
        <PreviewControls
          isPlaying={false}
          loopCount={1}
          onPlayPause={mockOnPlayPause}
        />
      );

      const playButton = screen.getByTitle('Play');
      expect(playButton).toBeTruthy();
    });

    it('should render pause button when playing', () => {
      render(
        <PreviewControls
          isPlaying={true}
          loopCount={1}
          onPlayPause={mockOnPlayPause}
        />
      );

      const pauseButton = screen.getByTitle('Pause');
      expect(pauseButton).toBeTruthy();
    });

    it('should display loop count', () => {
      render(
        <PreviewControls
          isPlaying={false}
          loopCount={3}
          onPlayPause={mockOnPlayPause}
        />
      );

      expect(screen.getByText('Loop 3')).toBeTruthy();
    });

    it('should display formatted time', () => {
      render(
        <PreviewControls
          isPlaying={false}
          loopCount={1}
          currentTime={65.5}
          duration={120}
          onPlayPause={mockOnPlayPause}
        />
      );

      expect(screen.getByText('1:05')).toBeTruthy();
      expect(screen.getByText('2:00')).toBeTruthy();
    });

    it('should render reset button when onReset is provided', () => {
      render(
        <PreviewControls
          isPlaying={false}
          loopCount={1}
          onPlayPause={mockOnPlayPause}
          onReset={mockOnReset}
        />
      );

      const resetButton = screen.getByTitle('Reset');
      expect(resetButton).toBeTruthy();
    });

    it('should render export button when onExport is provided', () => {
      render(
        <PreviewControls
          isPlaying={false}
          loopCount={1}
          onPlayPause={mockOnPlayPause}
          onExport={mockOnExport}
        />
      );

      const exportButton = screen.getByTitle('Export GIF');
      expect(exportButton).toBeTruthy();
    });

    it('should display settings info when provided', () => {
      const settings: Partial<GifSettings> = {
        frameRate: 15,
        resolution: '720p',
        quality: 'high',
        speed: 1.5
      };

      render(
        <PreviewControls
          isPlaying={false}
          loopCount={1}
          onPlayPause={mockOnPlayPause}
          settings={settings}
        />
      );

      expect(screen.getByText('15 FPS')).toBeTruthy();
      expect(screen.getByText('720p')).toBeTruthy();
      expect(screen.getByText('high quality')).toBeTruthy();
      expect(screen.getByText('1.5x speed')).toBeTruthy();
    });
  });

  describe('Progress Bar', () => {
    it('should display correct progress percentage', () => {
      const { container } = render(
        <PreviewControls
          isPlaying={false}
          loopCount={1}
          currentTime={30}
          duration={60}
          onPlayPause={mockOnPlayPause}
        />
      );

      const progressBar = container.querySelector('.bg-primary') as HTMLElement;
      expect(progressBar.style.width).toBe('50%');
    });

    it('should handle progress bar click for seeking', () => {
      const { container } = render(
        <PreviewControls
          isPlaying={false}
          loopCount={1}
          currentTime={0}
          duration={100}
          onPlayPause={mockOnPlayPause}
          onSeek={mockOnSeek}
        />
      );

      const progressContainer = container.querySelector('.cursor-pointer') as HTMLElement;

      // Mock getBoundingClientRect
      progressContainer.getBoundingClientRect = jest.fn(() => ({
        width: 400,
        left: 100,
        right: 500,
        top: 50,
        bottom: 60,
        height: 10,
        x: 100,
        y: 50,
        toJSON: () => ({})
      }));

      // Click at 25% of the progress bar
      fireEvent.click(progressContainer, { clientX: 200 });

      expect(mockOnSeek).toHaveBeenCalledWith(25);
    });

    it('should not seek when duration is 0', () => {
      const { container } = render(
        <PreviewControls
          isPlaying={false}
          loopCount={1}
          currentTime={0}
          duration={0}
          onPlayPause={mockOnPlayPause}
          onSeek={mockOnSeek}
        />
      );

      const progressContainer = container.querySelector('.cursor-pointer') as HTMLElement;
      fireEvent.click(progressContainer, { clientX: 200 });

      expect(mockOnSeek).not.toHaveBeenCalled();
    });

    it('should clamp seek value within bounds', () => {
      const { container } = render(
        <PreviewControls
          isPlaying={false}
          loopCount={1}
          currentTime={0}
          duration={100}
          onPlayPause={mockOnPlayPause}
          onSeek={mockOnSeek}
        />
      );

      const progressContainer = container.querySelector('.cursor-pointer') as HTMLElement;

      progressContainer.getBoundingClientRect = jest.fn(() => ({
        width: 400,
        left: 100,
        right: 500,
        top: 50,
        bottom: 60,
        height: 10,
        x: 100,
        y: 50,
        toJSON: () => ({})
      }));

      // Click beyond the end
      fireEvent.click(progressContainer, { clientX: 600 });

      expect(mockOnSeek).toHaveBeenCalledWith(100);
    });
  });

  describe('Control Actions', () => {
    it('should call onPlayPause when play/pause button clicked', () => {
      render(
        <PreviewControls
          isPlaying={false}
          loopCount={1}
          onPlayPause={mockOnPlayPause}
        />
      );

      const playButton = screen.getByTitle('Play');
      fireEvent.click(playButton);

      expect(mockOnPlayPause).toHaveBeenCalledTimes(1);
    });

    it('should call onReset when reset button clicked', () => {
      render(
        <PreviewControls
          isPlaying={false}
          loopCount={1}
          onPlayPause={mockOnPlayPause}
          onReset={mockOnReset}
        />
      );

      const resetButton = screen.getByTitle('Reset');
      fireEvent.click(resetButton);

      expect(mockOnReset).toHaveBeenCalledTimes(1);
    });

    it('should call onExport when export button clicked', () => {
      render(
        <PreviewControls
          isPlaying={false}
          loopCount={1}
          onPlayPause={mockOnPlayPause}
          onExport={mockOnExport}
        />
      );

      const exportButton = screen.getByTitle('Export GIF');
      fireEvent.click(exportButton);

      expect(mockOnExport).toHaveBeenCalledTimes(1);
    });
  });

  describe('Time Formatting', () => {
    it('should format single digit seconds with padding', () => {
      render(
        <PreviewControls
          isPlaying={false}
          loopCount={1}
          currentTime={5}
          duration={10}
          onPlayPause={mockOnPlayPause}
        />
      );

      expect(screen.getByText('0:05')).toBeTruthy();
    });

    it('should format minutes and seconds correctly', () => {
      render(
        <PreviewControls
          isPlaying={false}
          loopCount={1}
          currentTime={125}
          duration={300}
          onPlayPause={mockOnPlayPause}
        />
      );

      expect(screen.getByText('2:05')).toBeTruthy();
      expect(screen.getByText('5:00')).toBeTruthy();
    });
  });
});

describe('ControlButton', () => {
  let mockOnClick: jest.Mock;

  beforeEach(() => {
    mockOnClick = jest.fn();
  });

  it('should render with icon and label', () => {
    render(
      <ControlButton
        icon={<span>Icon</span>}
        label="Test Button"
        onClick={mockOnClick}
      />
    );

    const button = screen.getByTitle('Test Button');
    expect(button).toBeTruthy();
    expect(screen.getByText('Icon')).toBeTruthy();
  });

  it('should apply active styles when active', () => {
    render(
      <ControlButton
        icon={<span>Icon</span>}
        label="Test Button"
        onClick={mockOnClick}
        isActive={true}
      />
    );

    const button = screen.getByTitle('Test Button');
    expect(button.className).toContain('bg-primary');
    expect(button.className).toContain('text-primary-foreground');
  });

  it('should be disabled when disabled prop is true', () => {
    render(
      <ControlButton
        icon={<span>Icon</span>}
        label="Test Button"
        onClick={mockOnClick}
        disabled={true}
      />
    );

    const button = screen.getByTitle('Test Button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.className).toContain('opacity-50');
    expect(button.className).toContain('cursor-not-allowed');
  });

  it('should call onClick when clicked', () => {
    render(
      <ControlButton
        icon={<span>Icon</span>}
        label="Test Button"
        onClick={mockOnClick}
      />
    );

    const button = screen.getByTitle('Test Button');
    fireEvent.click(button);

    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });
});

describe('SpeedControl', () => {
  let mockOnChange: jest.Mock;

  beforeEach(() => {
    mockOnChange = jest.fn();
  });

  it('should render all speed options', () => {
    render(
      <SpeedControl
        value={1}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('0.25x')).toBeTruthy();
    expect(screen.getByText('0.5x')).toBeTruthy();
    expect(screen.getByText('0.75x')).toBeTruthy();
    expect(screen.getByText('1x')).toBeTruthy();
    expect(screen.getByText('1.25x')).toBeTruthy();
    expect(screen.getByText('1.5x')).toBeTruthy();
    expect(screen.getByText('2x')).toBeTruthy();
  });

  it('should highlight selected speed', () => {
    render(
      <SpeedControl
        value={1.5}
        onChange={mockOnChange}
      />
    );

    const selectedButton = screen.getByText('1.5x');
    expect(selectedButton.className).toContain('bg-primary');
    expect(selectedButton.className).toContain('text-primary-foreground');
  });

  it('should call onChange with selected speed', () => {
    render(
      <SpeedControl
        value={1}
        onChange={mockOnChange}
      />
    );

    const speedButton = screen.getByText('0.5x');
    fireEvent.click(speedButton);

    expect(mockOnChange).toHaveBeenCalledWith(0.5);
  });
});

describe('QualityControl', () => {
  let mockOnChange: jest.Mock;

  beforeEach(() => {
    mockOnChange = jest.fn();
  });

  it('should render all quality options', () => {
    render(
      <QualityControl
        value="medium"
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('low')).toBeTruthy();
    expect(screen.getByText('medium')).toBeTruthy();
    expect(screen.getByText('high')).toBeTruthy();
  });

  it('should highlight selected quality', () => {
    render(
      <QualityControl
        value="high"
        onChange={mockOnChange}
      />
    );

    const selectedButton = screen.getByText('high');
    expect(selectedButton.className).toContain('bg-primary');
    expect(selectedButton.className).toContain('text-primary-foreground');
  });

  it('should call onChange with selected quality', () => {
    render(
      <QualityControl
        value="medium"
        onChange={mockOnChange}
      />
    );

    const qualityButton = screen.getByText('low');
    fireEvent.click(qualityButton);

    expect(mockOnChange).toHaveBeenCalledWith('low');
  });
});

describe('FrameRateControl', () => {
  let mockOnChange: jest.Mock;

  beforeEach(() => {
    mockOnChange = jest.fn();
  });

  it('should display current frame rate', () => {
    render(
      <FrameRateControl
        value={15}
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('15 FPS')).toBeTruthy();
  });

  it('should display min and max values', () => {
    render(
      <FrameRateControl
        value={15}
        onChange={mockOnChange}
        min={10}
        max={25}
      />
    );

    expect(screen.getByText('10 FPS')).toBeTruthy();
    expect(screen.getByText('25 FPS')).toBeTruthy();
  });

  it('should call onChange when slider value changes', () => {
    render(
      <FrameRateControl
        value={15}
        onChange={mockOnChange}
      />
    );

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '20' } });

    expect(mockOnChange).toHaveBeenCalledWith(20);
  });

  it('should set correct range attributes', () => {
    render(
      <FrameRateControl
        value={15}
        onChange={mockOnChange}
        min={8}
        max={24}
      />
    );

    const slider = screen.getByRole('slider');
    expect(slider.getAttribute('min')).toBe('8');
    expect(slider.getAttribute('max')).toBe('24');
    expect(slider.getAttribute('value')).toBe('15');
  });
});

describe('ResolutionControl', () => {
  let mockOnChange: jest.Mock;

  beforeEach(() => {
    mockOnChange = jest.fn();
  });

  it('should display resolution label', () => {
    render(
      <ResolutionControl
        value="720p"
        onChange={mockOnChange}
      />
    );

    expect(screen.getByText('Resolution')).toBeTruthy();
  });

  it('should render default resolution options', () => {
    render(
      <ResolutionControl
        value="720p"
        onChange={mockOnChange}
      />
    );

    const select = screen.getByRole('combobox');
    expect(select.innerHTML).toContain('<option');
    expect(select.innerHTML).toContain('360p');
    expect(select.innerHTML).toContain('480p');
    expect(select.innerHTML).toContain('720p');
    expect(select.innerHTML).toContain('1080p');
  });

  it('should render custom resolution options', () => {
    render(
      <ResolutionControl
        value="540p"
        onChange={mockOnChange}
        options={['240p', '540p', '2160p']}
      />
    );

    const select = screen.getByRole('combobox');
    expect(select.innerHTML).toContain('240p');
    expect(select.innerHTML).toContain('540p');
    expect(select.innerHTML).toContain('2160p');
  });

  it('should call onChange when selection changes', () => {
    render(
      <ResolutionControl
        value="720p"
        onChange={mockOnChange}
      />
    );

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '1080p' } });

    expect(mockOnChange).toHaveBeenCalledWith('1080p');
  });

  it('should show current selected value', () => {
    render(
      <ResolutionControl
        value="480p"
        onChange={mockOnChange}
      />
    );

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('480p');
  });
});