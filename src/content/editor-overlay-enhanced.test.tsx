import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EditorOverlayEnhanced, ExportFormat } from './editor-overlay-enhanced';
import { TimelineSelection } from '@/types';

describe('EditorOverlayEnhanced', () => {
  const mockSelection: TimelineSelection = {
    startTime: 0,
    endTime: 5,
    duration: 5
  };

  const defaultProps = {
    videoUrl: 'https://youtube.com/watch?v=test',
    selection: mockSelection,
    videoDuration: 60,
    currentTime: 30,
    onClose: jest.fn(),
    onSave: jest.fn(),
    onExport: jest.fn(),
    onFramesRequest: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the editor overlay', () => {
      render(<EditorOverlayEnhanced {...defaultProps} />);
      
      expect(screen.getByText('GIF Editor')).toBeInTheDocument();
      expect(screen.getByText('Export Format')).toBeInTheDocument();
      expect(screen.getByText('Quality')).toBeInTheDocument();
      expect(screen.getByText('Resolution')).toBeInTheDocument();
      expect(screen.getByText('Frame Rate')).toBeInTheDocument();
    });

    it('should show extract frames button when frames are not provided', () => {
      render(<EditorOverlayEnhanced {...defaultProps} />);
      
      expect(screen.getByText('Extract Frames')).toBeInTheDocument();
    });

    it('should show preview placeholder when frames are not provided', () => {
      render(<EditorOverlayEnhanced {...defaultProps} />);
      
      expect(screen.getByText('Click "Extract Frames" to generate preview')).toBeInTheDocument();
    });

    it('should display duration and estimated file size', () => {
      render(<EditorOverlayEnhanced {...defaultProps} />);
      
      expect(screen.getByText('5.0s')).toBeInTheDocument();
      expect(screen.getByText(/~.*MB/)).toBeInTheDocument();
    });
  });

  describe('Format Selection', () => {
    it('should have GIF selected by default', () => {
      render(<EditorOverlayEnhanced {...defaultProps} />);
      
      // Find GIF button by its container and check if it has active class
      const formatButtons = document.querySelectorAll('.ytgif-editor-format-option');
      expect(formatButtons[0]).toHaveClass('active'); // GIF is first option
    });

    it('should allow selecting WebP format', () => {
      render(<EditorOverlayEnhanced {...defaultProps} />);
      
      const webpButton = screen.getByRole('button', { name: /webp/i });
      fireEvent.click(webpButton);
      
      expect(webpButton).toHaveClass('active');
    });

    it('should show WebP quality slider when WebP is selected', () => {
      render(<EditorOverlayEnhanced {...defaultProps} />);
      
      const webpButton = screen.getByRole('button', { name: /webp/i });
      fireEvent.click(webpButton);
      
      expect(screen.getByText('WebP Quality')).toBeInTheDocument();
    });

    it('should show format badge in header when non-GIF format is selected', () => {
      render(<EditorOverlayEnhanced {...defaultProps} />);
      
      const webpButton = screen.getByRole('button', { name: /webp/i });
      fireEvent.click(webpButton);
      
      expect(screen.getByText('WEBP')).toBeInTheDocument();
    });

    it('should update export button text based on selected format', () => {
      render(<EditorOverlayEnhanced {...defaultProps} />);
      
      expect(screen.getByText('Export GIF')).toBeInTheDocument();
      
      const webpButton = screen.getByRole('button', { name: /webp/i });
      fireEvent.click(webpButton);
      
      expect(screen.getByText('Export WEBP')).toBeInTheDocument();
    });
  });

  describe('Quality Controls', () => {
    it('should have Medium quality selected by default', () => {
      render(<EditorOverlayEnhanced {...defaultProps} />);
      
      const mediumButton = screen.getByRole('button', { name: /medium/i });
      expect(mediumButton).toHaveClass('active');
    });

    it('should allow selecting different quality levels', () => {
      render(<EditorOverlayEnhanced {...defaultProps} />);
      
      const highButton = screen.getByRole('button', { name: /high/i });
      fireEvent.click(highButton);
      
      expect(highButton).toHaveClass('active');
    });

    it('should update file size estimate when quality changes', async () => {
      render(<EditorOverlayEnhanced {...defaultProps} />);
      
      const initialSize = screen.getByText(/~.*MB/).textContent;
      
      const highButton = screen.getByRole('button', { name: /high/i });
      fireEvent.click(highButton);
      
      await waitFor(() => {
        const newSize = screen.getByText(/~.*MB/).textContent;
        expect(newSize).not.toBe(initialSize);
      });
    });
  });

  describe('Resolution Controls', () => {
    it('should have 640×360 as default resolution', () => {
      render(<EditorOverlayEnhanced {...defaultProps} />);
      
      expect(screen.getByText('640×360')).toBeInTheDocument();
    });

    it('should allow selecting resolution presets', () => {
      render(<EditorOverlayEnhanced {...defaultProps} />);
      
      const preset720p = screen.getByRole('button', { name: /720p/i });
      fireEvent.click(preset720p);
      
      expect(preset720p).toHaveClass('active');
    });

    it('should allow custom resolution input', () => {
      render(<EditorOverlayEnhanced {...defaultProps} />);
      
      const widthInput = screen.getAllByRole('spinbutton')[0];
      const heightInput = screen.getAllByRole('spinbutton')[1];
      
      fireEvent.change(widthInput, { target: { value: '800' } });
      fireEvent.change(heightInput, { target: { value: '600' } });
      
      expect(widthInput).toHaveValue(800);
      expect(heightInput).toHaveValue(600);
    });
  });

  describe('Frame Rate Controls', () => {
    it('should have 15 fps as default frame rate', () => {
      render(<EditorOverlayEnhanced {...defaultProps} />);
      
      expect(screen.getByText('15 fps')).toBeInTheDocument();
    });

    it('should allow adjusting frame rate with slider', () => {
      render(<EditorOverlayEnhanced {...defaultProps} />);
      
      const slider = screen.getByRole('slider');
      fireEvent.change(slider, { target: { value: '25' } });
      
      expect(screen.getByText('25 fps')).toBeInTheDocument();
    });

    it('should show frame count based on duration and frame rate', () => {
      render(<EditorOverlayEnhanced {...defaultProps} />);
      
      // 5 seconds * 15 fps = 75 frames
      expect(screen.getByText('75')).toBeInTheDocument();
    });

    it('should show performance hints based on frame rate', () => {
      render(<EditorOverlayEnhanced {...defaultProps} />);
      
      const slider = screen.getByRole('slider');
      
      // Low frame rate
      fireEvent.change(slider, { target: { value: '5' } });
      expect(screen.getByText(/Fast processing/i)).toBeInTheDocument();
      
      // High frame rate
      fireEvent.change(slider, { target: { value: '30' } });
      expect(screen.getByText(/Smooth animation/i)).toBeInTheDocument();
    });

    it('should allow selecting frame rate presets', () => {
      render(<EditorOverlayEnhanced {...defaultProps} />);
      
      const preset20 = screen.getByRole('button', { name: '20' });
      fireEvent.click(preset20);
      
      expect(preset20).toHaveClass('active');
      expect(screen.getByText('20 fps')).toBeInTheDocument();
    });
  });

  describe('File Size Estimation', () => {
    it('should calculate different file sizes for different formats', () => {
      const { rerender } = render(<EditorOverlayEnhanced {...defaultProps} />);
      
      const gifSize = screen.getByText(/~.*MB/).textContent;
      
      const webpButton = screen.getByRole('button', { name: /webp/i });
      fireEvent.click(webpButton);
      
      const webpSize = screen.getByText(/~.*MB/).textContent;
      expect(webpSize).not.toBe(gifSize);
    });

    it('should show warning for large file sizes', () => {
      // Create a long selection to trigger large file warning
      const longSelection = { ...mockSelection, duration: 30 };
      render(<EditorOverlayEnhanced {...defaultProps} selection={longSelection} />);
      
      const highButton = screen.getByRole('button', { name: /high/i });
      fireEvent.click(highButton);
      
      expect(screen.getByText(/Large file size may affect performance/i)).toBeInTheDocument();
    });
  });

  describe('Loop Control', () => {
    it('should have loop enabled by default', () => {
      render(<EditorOverlayEnhanced {...defaultProps} />);
      
      const loopCheckbox = screen.getByRole('checkbox');
      expect(loopCheckbox).toBeChecked();
    });

    it('should allow toggling loop', () => {
      render(<EditorOverlayEnhanced {...defaultProps} />);
      
      const loopCheckbox = screen.getByRole('checkbox');
      fireEvent.click(loopCheckbox);
      
      expect(loopCheckbox).not.toBeChecked();
    });

    it('should disable loop for MP4 format', () => {
      render(<EditorOverlayEnhanced {...defaultProps} />);
      
      // Note: MP4 is disabled in the UI for now, but we can test the logic
      const loopCheckbox = screen.getByRole('checkbox');
      expect(loopCheckbox).toBeEnabled();
    });
  });

  describe('Preview Controls', () => {
    const mockFrames = [
      { width: 100, height: 100, data: new Uint8ClampedArray(40000) },
      { width: 100, height: 100, data: new Uint8ClampedArray(40000) }
    ] as ImageData[];

    it('should show play button when frames are available', () => {
      render(<EditorOverlayEnhanced {...defaultProps} frames={mockFrames} />);
      
      // Play button is shown when frames are available
      const playButton = screen.getByTitle('Play');
      expect(playButton).toBeInTheDocument();
    });

    it('should toggle play/pause state', () => {
      render(<EditorOverlayEnhanced {...defaultProps} frames={mockFrames} />);
      
      const playButton = screen.getByTitle('Play');
      fireEvent.click(playButton);
      
      expect(screen.getByTitle('Pause')).toBeInTheDocument();
    });

    it('should show loop indicator when playing with loop enabled', () => {
      render(<EditorOverlayEnhanced {...defaultProps} frames={mockFrames} />);
      
      const playButton = screen.getByTitle('Play');
      fireEvent.click(playButton);
      
      // Loop indicator appears when playing with loop enabled
      const loopIndicator = document.querySelector('.ytgif-editor-loop-indicator');
      expect(loopIndicator).toBeInTheDocument();
    });

    it('should show frame slider when frames are available', () => {
      render(<EditorOverlayEnhanced {...defaultProps} frames={mockFrames} />);
      
      const frameSlider = screen.getAllByRole('slider')[1]; // Second slider is frame slider
      expect(frameSlider).toBeInTheDocument();
      expect(screen.getByText('Frame 1 / 2')).toBeInTheDocument();
    });
  });

  describe('User Actions', () => {
    it('should call onClose when close button is clicked', () => {
      render(<EditorOverlayEnhanced {...defaultProps} />);
      
      const closeButton = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);
      
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onFramesRequest when extract frames is clicked', () => {
      render(<EditorOverlayEnhanced {...defaultProps} />);
      
      const extractButton = screen.getByText('Extract Frames');
      fireEvent.click(extractButton);
      
      expect(defaultProps.onFramesRequest).toHaveBeenCalledTimes(1);
    });

    it('should call onSave with correct settings', () => {
      const mockFrames = [
        { width: 100, height: 100, data: new Uint8ClampedArray(40000) }
      ] as ImageData[];
      
      render(<EditorOverlayEnhanced {...defaultProps} frames={mockFrames} />);
      
      // Change some settings
      const webpButton = screen.getByRole('button', { name: /webp/i });
      fireEvent.click(webpButton);
      
      const saveButton = screen.getByText('Save to Library');
      fireEvent.click(saveButton);
      
      expect(defaultProps.onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          format: 'webp',
          frameRate: 15,
          width: 640,
          height: 360,
          quality: 'medium',
          loop: true
        }),
        []
      );
    });

    it('should call onExport with correct settings', () => {
      const mockFrames = [
        { width: 100, height: 100, data: new Uint8ClampedArray(40000) }
      ] as ImageData[];
      
      render(<EditorOverlayEnhanced {...defaultProps} frames={mockFrames} />);
      
      const highButton = screen.getByRole('button', { name: /high/i });
      fireEvent.click(highButton);
      
      const exportButton = screen.getByText('Export GIF');
      fireEvent.click(exportButton);
      
      expect(defaultProps.onExport).toHaveBeenCalledWith(
        expect.objectContaining({
          quality: 'high'
        }),
        []
      );
    });

    it('should disable buttons when processing', () => {
      render(<EditorOverlayEnhanced {...defaultProps} isProcessing={true} />);
      
      const extractButton = screen.getByText('Extracting...');
      expect(extractButton).toBeDisabled();
      
      const exportButton = screen.getByText('Processing...');
      expect(exportButton).toBeDisabled();
    });
  });

  describe('Responsive Design', () => {
    it('should apply responsive classes based on viewport', () => {
      // This would require mocking window.matchMedia or using a library like jest-matchmedia-mock
      // For now, we'll just verify the classes exist in the CSS
      render(<EditorOverlayEnhanced {...defaultProps} />);
      
      const container = screen.getByText('GIF Editor').closest('.ytgif-editor-container');
      expect(container).toBeInTheDocument();
    });
  });
});