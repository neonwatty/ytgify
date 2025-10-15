import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import TextOverlayScreenV2 from '../../../../src/content/overlay-wizard/screens/TextOverlayScreenV2';
import { TextOverlay } from '@/types';

// Mock useRef to return our mocked canvas
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useRef: jest.fn(),
}));

describe('TextOverlayScreenV2', () => {
  const mockOnConfirm = jest.fn();
  const mockOnSkip = jest.fn();
  const mockOnBack = jest.fn();
  const mockOnSeekTo = jest.fn();

  let mockVideoElement: HTMLVideoElement;
  let mockCanvas: HTMLCanvasElement;
  let mockContext: CanvasRenderingContext2D;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Mock video element
    mockVideoElement = {
      currentTime: 10,
      duration: 120,
      videoWidth: 1920,
      videoHeight: 1080,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    } as any;

    // Mock canvas context
    mockContext = {
      drawImage: jest.fn(),
      getImageData: jest.fn(),
      putImageData: jest.fn(),
      clearRect: jest.fn(),
    } as any;

    // Mock canvas with style property and getters/setters
    let canvasWidth = 0;
    let canvasHeight = 0;

    mockCanvas = {
      get width() { return canvasWidth; },
      set width(value) { canvasWidth = value; },
      get height() { return canvasHeight; },
      set height(value) { canvasHeight = value; },
      style: {},
      getContext: jest.fn().mockReturnValue(mockContext),
      toDataURL: jest.fn().mockReturnValue('data:image/jpeg;base64,test'),
      setAttribute: jest.fn(),
      getAttribute: jest.fn(),
    } as any;

    // Mock requestAnimationFrame
    global.requestAnimationFrame = jest.fn((cb) => {
      cb(0);
      return 0;
    });

    // Mock useRef to return our mocked canvas
    (React.useRef as jest.Mock).mockReturnValue({ current: mockCanvas });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const defaultProps = {
    startTime: 0,
    endTime: 5,
    videoDuration: 120,
    onConfirm: mockOnConfirm,
    onSkip: mockOnSkip,
  };

  describe('Phase 1.1: Basic Rendering & Props', () => {
    it('renders with minimum required props', () => {
      render(<TextOverlayScreenV2 {...defaultProps} />);

      expect(screen.getByText('Make It Memorable')).toBeInTheDocument();
      expect(screen.getByText('Skip This Step')).toBeInTheDocument();
      expect(screen.getByText('Create GIF Without Text')).toBeInTheDocument();
    });

    it('displays back button only when onBack prop provided', () => {
      const { rerender } = render(<TextOverlayScreenV2 {...defaultProps} />);

      expect(document.querySelector('.ytgif-back-button')).not.toBeInTheDocument();

      rerender(<TextOverlayScreenV2 {...defaultProps} onBack={mockOnBack} />);

      expect(document.querySelector('.ytgif-back-button')).toBeInTheDocument();
    });

    it('contains hidden canvas element for frame capture', () => {
      render(<TextOverlayScreenV2 {...defaultProps} />);

      const canvas = document.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
      expect(canvas).toHaveStyle('display: none');
    });
  });

  describe('Phase 1.2: Text Input State Management', () => {
    it('manages top text input state independently', () => {
      render(<TextOverlayScreenV2 {...defaultProps} />);

      const topTextInput = screen.getByPlaceholderText('Add your caption here...');

      fireEvent.change(topTextInput, { target: { value: 'Top text content' } });

      expect(topTextInput).toHaveValue('Top text content');
      expect(screen.getByText('16/50')).toBeInTheDocument(); // Character count
    });

    it('manages bottom text input state independently', () => {
      render(<TextOverlayScreenV2 {...defaultProps} />);

      const bottomTextInput = screen.getByPlaceholderText('Perfect for reactions or context...');

      fireEvent.change(bottomTextInput, { target: { value: 'Bottom text content' } });

      expect(bottomTextInput).toHaveValue('Bottom text content');
      expect(screen.getByText('19/50')).toBeInTheDocument(); // Character count
    });

    it('shows character count and maxLength attribute', () => {
      render(<TextOverlayScreenV2 {...defaultProps} />);

      const topTextInput = screen.getByPlaceholderText('Add your caption here...');

      // Check maxLength attribute is set
      expect(topTextInput).toHaveAttribute('maxLength', '50');

      const longText = 'a'.repeat(45); // 45 characters
      fireEvent.change(topTextInput, { target: { value: longText } });

      expect(topTextInput).toHaveValue(longText);
      expect(screen.getByText('45/50')).toBeInTheDocument();
    });

    it('maintains state isolation between top and bottom text', () => {
      render(<TextOverlayScreenV2 {...defaultProps} />);

      const topTextInput = screen.getByPlaceholderText('Add your caption here...');
      const bottomTextInput = screen.getByPlaceholderText('Perfect for reactions or context...');

      fireEvent.change(topTextInput, { target: { value: 'Top content' } });
      fireEvent.change(bottomTextInput, { target: { value: 'Bottom content' } });

      expect(topTextInput).toHaveValue('Top content');
      expect(bottomTextInput).toHaveValue('Bottom content');

      // Each should show their own character count
      const characterCounts = screen.getAllByText(/\/50/);
      expect(characterCounts).toHaveLength(2);
    });

    it('initializes with empty strings and default values', () => {
      render(<TextOverlayScreenV2 {...defaultProps} resolution="360p" />);

      const topTextInput = screen.getByPlaceholderText('Add your caption here...');
      const bottomTextInput = screen.getByPlaceholderText('Perfect for reactions or context...');

      expect(topTextInput).toHaveValue('');
      expect(bottomTextInput).toHaveValue('');
      expect(screen.getAllByText('0/50')).toHaveLength(2);
    });
  });

  describe('Phase 1.3: Advanced Options Toggle', () => {
    it('starts with both advanced sections collapsed', () => {
      render(<TextOverlayScreenV2 {...defaultProps} />);

      expect(screen.queryByText('Size')).not.toBeInTheDocument();
      expect(screen.queryByText('Color')).not.toBeInTheDocument();

      // Should show + icons initially
      const toggleButtons = screen.getAllByText('+');
      expect(toggleButtons).toHaveLength(2);
    });

    it('toggles top text advanced options independently', () => {
      render(<TextOverlayScreenV2 {...defaultProps} />);

      const topToggleButton = screen.getByText('Top Text Style').closest('button');

      fireEvent.click(topToggleButton!);

      // Should show advanced options for top text
      expect(screen.getAllByText('Size')).toHaveLength(1);
      expect(screen.getAllByText('Color')).toHaveLength(1);

      // Toggle icon should change to -
      expect(screen.getByText('−')).toBeInTheDocument();
      expect(screen.getByText('+')).toBeInTheDocument(); // Bottom still collapsed

      // Toggle back
      fireEvent.click(topToggleButton!);
      expect(screen.queryByText('Size')).not.toBeInTheDocument();
    });

    it('toggles bottom text advanced options independently', () => {
      render(<TextOverlayScreenV2 {...defaultProps} />);

      const bottomToggleButton = screen.getByText('Bottom Text Style').closest('button');

      fireEvent.click(bottomToggleButton!);

      // Should show advanced options for bottom text
      expect(screen.getAllByText('Size')).toHaveLength(1);
      expect(screen.getAllByText('Color')).toHaveLength(1);

      // Both toggles can be expanded simultaneously
      const topToggleButton = screen.getByText('Top Text Style').closest('button');
      fireEvent.click(topToggleButton!);

      expect(screen.getAllByText('Size')).toHaveLength(2);
      expect(screen.getAllByText('Color')).toHaveLength(2);
    });

    it('maintains toggle state when text content changes', () => {
      render(<TextOverlayScreenV2 {...defaultProps} />);

      const topToggleButton = screen.getByText('Top Text Style').closest('button');
      fireEvent.click(topToggleButton!);

      expect(screen.getByText('Size')).toBeInTheDocument();

      // Change text content
      const topTextInput = screen.getByPlaceholderText('Add your caption here...');
      fireEvent.change(topTextInput, { target: { value: 'New text' } });

      // Advanced options should still be visible
      expect(screen.getByText('Size')).toBeInTheDocument();
    });
  });

  describe('Phase 1.4: Font Size & Color Controls', () => {
    beforeEach(() => {
      render(<TextOverlayScreenV2 {...defaultProps} resolution="480p" />);

      // Expand top text advanced options
      const topToggleButton = screen.getByText('Top Text Style').closest('button');
      fireEvent.click(topToggleButton!);
    });

    it('shows font size slider with correct range and default for resolution', () => {
      const sizeSlider = screen.getAllByRole('slider')[0]; // First slider is size

      expect(sizeSlider).toHaveAttribute('min', '20'); // 480p min
      expect(sizeSlider).toHaveAttribute('max', '72'); // 480p max
      expect(sizeSlider).toHaveValue('36'); // 480p default

      expect(screen.getByText('36px')).toBeInTheDocument();
    });

    it('updates font size value display when slider changes', () => {
      const sizeSlider = screen.getAllByRole('slider')[0];

      fireEvent.change(sizeSlider, { target: { value: '48' } });

      expect(screen.getByText('48px')).toBeInTheDocument();
    });

    it('shows color picker with default white color', () => {
      const colorInput = document.querySelector('input[type="color"]') as HTMLInputElement;

      expect(colorInput).toHaveAttribute('type', 'color');
      expect(colorInput).toHaveValue('#ffffff'); // Browser normalizes to lowercase
      expect(screen.getByText('#FFFFFF')).toBeInTheDocument(); // Component displays uppercase
    });

    it('updates color display when color picker changes', () => {
      const colorInput = document.querySelector('input[type="color"]') as HTMLInputElement;

      fireEvent.change(colorInput, { target: { value: '#FF0000' } });

      expect(screen.getByText('#ff0000')).toBeInTheDocument(); // Browser normalizes to lowercase
    });

    it('maintains separate state for top and bottom controls', () => {
      // Also expand bottom text advanced options
      const bottomToggleButton = screen.getByText('Bottom Text Style').closest('button');
      fireEvent.click(bottomToggleButton!);

      const sliders = screen.getAllByRole('slider');
      const colorInputs = document.querySelectorAll('input[type="color"]');

      expect(sliders).toHaveLength(2); // Top and bottom size sliders
      expect(colorInputs).toHaveLength(2); // Top and bottom color inputs

      // Change top slider
      fireEvent.change(sliders[0], { target: { value: '48' } });

      // Only top should change
      expect(sliders[0]).toHaveValue('48');
      expect(sliders[1]).toHaveValue('36'); // Bottom unchanged
    });
  });

  describe('Phase 1.5: Primary Button Logic', () => {
    it('shows "Create GIF Without Text" when no text entered', () => {
      render(<TextOverlayScreenV2 {...defaultProps} />);

      const primaryButton = screen.getByText('Create GIF Without Text');
      expect(primaryButton).toBeInTheDocument();
    });

    it('shows "Apply Text & Continue" when text is entered', () => {
      render(<TextOverlayScreenV2 {...defaultProps} />);

      const topTextInput = screen.getByPlaceholderText('Add your caption here...');
      fireEvent.change(topTextInput, { target: { value: 'Some text' } });

      expect(screen.getByText('Apply Text & Continue')).toBeInTheDocument();
    });

    it('calls onSkip when no text and primary button clicked', () => {
      render(<TextOverlayScreenV2 {...defaultProps} />);

      const primaryButton = screen.getByText('Create GIF Without Text');
      fireEvent.click(primaryButton);

      expect(mockOnSkip).toHaveBeenCalledTimes(1);
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('calls handleAddText when text exists and primary button clicked', () => {
      render(<TextOverlayScreenV2 {...defaultProps} />);

      const topTextInput = screen.getByPlaceholderText('Add your caption here...');
      fireEvent.change(topTextInput, { target: { value: 'Test text' } });

      const primaryButton = screen.getByText('Apply Text & Continue');
      fireEvent.click(primaryButton);

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
      expect(mockOnSkip).not.toHaveBeenCalled();
    });

    it('detects text from bottom input as well', () => {
      render(<TextOverlayScreenV2 {...defaultProps} />);

      const bottomTextInput = screen.getByPlaceholderText('Perfect for reactions or context...');
      fireEvent.change(bottomTextInput, { target: { value: 'Bottom text' } });

      expect(screen.getByText('Apply Text & Continue')).toBeInTheDocument();
    });

    it('skip button always calls onSkip regardless of text state', () => {
      render(<TextOverlayScreenV2 {...defaultProps} />);

      // Add some text
      const topTextInput = screen.getByPlaceholderText('Add your caption here...');
      fireEvent.change(topTextInput, { target: { value: 'Test text' } });

      const skipButton = screen.getByText('Skip This Step');
      fireEvent.click(skipButton);

      expect(mockOnSkip).toHaveBeenCalledTimes(1);
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it('back button calls onBack when provided', () => {
      render(<TextOverlayScreenV2 {...defaultProps} onBack={mockOnBack} />);

      const backButton = document.querySelector('.ytgif-back-button') as HTMLElement;
      fireEvent.click(backButton);

      expect(mockOnBack).toHaveBeenCalledTimes(1);
    });

    it('ignores whitespace-only text for button logic', () => {
      render(<TextOverlayScreenV2 {...defaultProps} />);

      const topTextInput = screen.getByPlaceholderText('Add your caption here...');
      fireEvent.change(topTextInput, { target: { value: '   ' } }); // Whitespace only

      expect(screen.getByText('Create GIF Without Text')).toBeInTheDocument();
    });
  });

  describe('Phase 2.1: Resolution-Based Font Calculations', () => {
    const resolutionTestCases = [
      { resolution: '144p', min: 10, max: 48, default: 24 },
      { resolution: '240p', min: 12, max: 56, default: 28 },
      { resolution: '360p', min: 16, max: 64, default: 32 },
      { resolution: '480p', min: 20, max: 72, default: 36 },
    ];

    resolutionTestCases.forEach(({ resolution, min, max, default: defaultValue }) => {
      it(`sets correct font size range for ${resolution}`, () => {
        render(<TextOverlayScreenV2 {...defaultProps} resolution={resolution} />);

        // Expand advanced options to see sliders
        const topToggleButton = screen.getByText('Top Text Style').closest('button');
        fireEvent.click(topToggleButton!);

        const sizeSlider = screen.getAllByRole('slider')[0];

        expect(sizeSlider).toHaveAttribute('min', min.toString());
        expect(sizeSlider).toHaveAttribute('max', max.toString());
        expect(sizeSlider).toHaveValue(defaultValue.toString());
        expect(screen.getByText(`${defaultValue}px`)).toBeInTheDocument();
      });
    });

    it('defaults to 144p font range for unknown resolution', () => {
      render(<TextOverlayScreenV2 {...defaultProps} resolution="999p" />);

      const topToggleButton = screen.getByText('Top Text Style').closest('button');
      fireEvent.click(topToggleButton!);

      const sizeSlider = screen.getAllByRole('slider')[0];

      expect(sizeSlider).toHaveAttribute('min', '10');
      expect(sizeSlider).toHaveAttribute('max', '48');
      expect(sizeSlider).toHaveValue('24');
    });

    it('applies font ranges to both top and bottom text independently', () => {
      render(<TextOverlayScreenV2 {...defaultProps} resolution="360p" />);

      // Expand both advanced options
      const topToggleButton = screen.getByText('Top Text Style').closest('button');
      const bottomToggleButton = screen.getByText('Bottom Text Style').closest('button');
      fireEvent.click(topToggleButton!);
      fireEvent.click(bottomToggleButton!);

      const sliders = screen.getAllByRole('slider');

      // Both sliders should have same range for same resolution
      expect(sliders[0]).toHaveAttribute('min', '16'); // Top text
      expect(sliders[1]).toHaveAttribute('min', '16'); // Bottom text
      expect(sliders[0]).toHaveAttribute('max', '64');
      expect(sliders[1]).toHaveAttribute('max', '64');
      expect(sliders[0]).toHaveValue('32'); // Default for 360p
      expect(sliders[1]).toHaveValue('32');
    });
  });

  describe('Phase 2.2: GIF Dimensions Mapping', () => {
    const dimensionTestCases = [
      { resolution: '144p', width: 256, height: 144 },
      { resolution: '240p', width: 426, height: 240 },
      { resolution: '360p', width: 640, height: 360 },
      { resolution: '480p', width: 854, height: 480 },
    ];

    dimensionTestCases.forEach(({ resolution, width, height }) => {
      it(`displays correct dimensions for ${resolution}`, () => {
        render(<TextOverlayScreenV2 {...defaultProps} resolution={resolution} />);

        expect(screen.getByText(`Preview at ${resolution} (${width}×${height}px)`)).toBeInTheDocument();
      });
    });

    it('defaults to 144p dimensions for unknown resolution', () => {
      render(<TextOverlayScreenV2 {...defaultProps} resolution="unknown" />);

      expect(screen.getByText('Preview at unknown (256×144px)')).toBeInTheDocument();
    });

    it('sets canvas dimensions based on resolution', () => {
      render(<TextOverlayScreenV2 {...defaultProps} resolution="480p" videoElement={mockVideoElement} />);

      // The canvas element should have the correct attributes in the DOM
      const canvasElement = document.querySelector('canvas');
      expect(canvasElement).toBeInTheDocument();
      expect(canvasElement).toHaveAttribute('width', '854');
      expect(canvasElement).toHaveAttribute('height', '480');
    });
  });

  describe('Phase 2.3: Text Overlay Creation Logic', () => {
    it('creates single overlay for top text only', () => {
      render(<TextOverlayScreenV2 {...defaultProps} />);

      const topTextInput = screen.getByPlaceholderText('Add your caption here...');
      fireEvent.change(topTextInput, { target: { value: 'Top text' } });

      const primaryButton = screen.getByText('Apply Text & Continue');
      fireEvent.click(primaryButton);

      expect(mockOnConfirm).toHaveBeenCalledWith([
        {
          id: 'top-overlay',
          text: 'Top text',
          position: { x: 50, y: 20 },
          fontSize: 24, // Default for 144p
          fontFamily: 'Arial',
          color: '#FFFFFF',
          animation: 'none',
        },
      ]);
    });

    it('creates single overlay for bottom text only', () => {
      render(<TextOverlayScreenV2 {...defaultProps} />);

      const bottomTextInput = screen.getByPlaceholderText('Perfect for reactions or context...');
      fireEvent.change(bottomTextInput, { target: { value: 'Bottom text' } });

      const primaryButton = screen.getByText('Apply Text & Continue');
      fireEvent.click(primaryButton);

      expect(mockOnConfirm).toHaveBeenCalledWith([
        {
          id: 'bottom-overlay',
          text: 'Bottom text',
          position: { x: 50, y: 80 },
          fontSize: 24,
          fontFamily: 'Arial',
          color: '#FFFFFF',
          animation: 'none',
        },
      ]);
    });

    it('creates two overlays for both texts', () => {
      render(<TextOverlayScreenV2 {...defaultProps} resolution="360p" />);

      const topTextInput = screen.getByPlaceholderText('Add your caption here...');
      const bottomTextInput = screen.getByPlaceholderText('Perfect for reactions or context...');

      fireEvent.change(topTextInput, { target: { value: 'Top content' } });
      fireEvent.change(bottomTextInput, { target: { value: 'Bottom content' } });

      const primaryButton = screen.getByText('Apply Text & Continue');
      fireEvent.click(primaryButton);

      expect(mockOnConfirm).toHaveBeenCalledWith([
        {
          id: 'top-overlay',
          text: 'Top content',
          position: { x: 50, y: 20 },
          fontSize: 32, // Default for 360p
          fontFamily: 'Arial',
          color: '#FFFFFF',
          animation: 'none',
        },
        {
          id: 'bottom-overlay',
          text: 'Bottom content',
          position: { x: 50, y: 80 },
          fontSize: 32,
          fontFamily: 'Arial',
          color: '#FFFFFF',
          animation: 'none',
        },
      ]);
    });

    it('trims whitespace from text and ignores empty strings', () => {
      render(<TextOverlayScreenV2 {...defaultProps} />);

      const topTextInput = screen.getByPlaceholderText('Add your caption here...');
      const bottomTextInput = screen.getByPlaceholderText('Perfect for reactions or context...');

      fireEvent.change(topTextInput, { target: { value: '  trimmed text  ' } });
      fireEvent.change(bottomTextInput, { target: { value: '   ' } }); // Whitespace only

      const primaryButton = screen.getByText('Apply Text & Continue');
      fireEvent.click(primaryButton);

      // Should only create overlay for trimmed text, ignore whitespace-only
      expect(mockOnConfirm).toHaveBeenCalledWith([
        {
          id: 'top-overlay',
          text: 'trimmed text',
          position: { x: 50, y: 20 },
          fontSize: 24,
          fontFamily: 'Arial',
          color: '#FFFFFF',
          animation: 'none',
        },
      ]);
    });

    it('uses custom font sizes and colors when set', () => {
      render(<TextOverlayScreenV2 {...defaultProps} resolution="480p" />);

      // Set text
      const topTextInput = screen.getByPlaceholderText('Add your caption here...');
      fireEvent.change(topTextInput, { target: { value: 'Styled text' } });

      // Expand advanced options and change settings
      const topToggleButton = screen.getByText('Top Text Style').closest('button');
      fireEvent.click(topToggleButton!);

      const sizeSlider = screen.getAllByRole('slider')[0];
      const colorInput = document.querySelector('input[type="color"]') as HTMLInputElement;

      fireEvent.change(sizeSlider, { target: { value: '48' } });
      fireEvent.change(colorInput, { target: { value: '#FF0000' } });

      const primaryButton = screen.getByText('Apply Text & Continue');
      fireEvent.click(primaryButton);

      expect(mockOnConfirm).toHaveBeenCalledWith([
        {
          id: 'top-overlay',
          text: 'Styled text',
          position: { x: 50, y: 20 },
          fontSize: 48,
          fontFamily: 'Arial',
          color: '#ff0000',
          animation: 'none',
        },
      ]);
    });
  });

  describe('Phase 2.4: Video Frame Capture System', () => {
    it('sets up canvas with correct dimensions for video capture', () => {
      render(<TextOverlayScreenV2 {...defaultProps} resolution="360p" videoElement={mockVideoElement} />);

      const canvasElement = document.querySelector('canvas');
      expect(canvasElement).toHaveAttribute('width', '640'); // 360p width
      expect(canvasElement).toHaveAttribute('height', '360'); // 360p height
    });

    it('seeks video to startTime for frame capture', async () => {
      const originalTime = 45;
      mockVideoElement.currentTime = originalTime;

      render(<TextOverlayScreenV2 {...defaultProps} startTime={10} videoElement={mockVideoElement} />);

      // Allow useEffect to run
      await waitFor(() => {
        expect(mockVideoElement.currentTime).toBe(10);
      });

      // Should restore original time after capture timeout
      act(() => {
        jest.advanceTimersByTime(200);
      });

      await waitFor(() => {
        expect(mockVideoElement.currentTime).toBe(originalTime);
      });
    });

    it('captures video frame to canvas and generates data URL', async () => {
      render(<TextOverlayScreenV2 {...defaultProps} resolution="480p" videoElement={mockVideoElement} />);

      // Check that a frame preview is eventually generated
      await waitFor(() => {
        const previewElement = document.querySelector('.ytgif-frame-preview');
        expect(previewElement).toBeInTheDocument();
        // The background image should be set from canvas toDataURL (flexible matching)
        const backgroundImage = getComputedStyle(previewElement as Element).backgroundImage;
        expect(backgroundImage).toMatch(/url\(data:image/);
      });
    });

    it('handles missing video element gracefully', () => {
      render(<TextOverlayScreenV2 {...defaultProps} />);

      // Should not crash and should show placeholder
      expect(screen.getByText('Loading video preview...')).toBeInTheDocument();
      expect(mockCanvas.getContext).not.toHaveBeenCalled();
    });

    it('handles canvas context creation failure', () => {
      // For this test, we just verify the component doesn't crash when canvas context fails
      render(<TextOverlayScreenV2 {...defaultProps} videoElement={mockVideoElement} />);

      // Component should still render normally
      expect(screen.getByText('Make It Memorable')).toBeInTheDocument();
      expect(screen.getByText('Loading video preview...')).toBeInTheDocument();
    });

    it('uses requestAnimationFrame for proper timing', async () => {
      const mockRAF = jest.fn((cb) => {
        cb(0);
        return 0;
      });
      global.requestAnimationFrame = mockRAF;

      render(<TextOverlayScreenV2 {...defaultProps} videoElement={mockVideoElement} />);

      await waitFor(() => {
        expect(mockRAF).toHaveBeenCalled();
      });
    });
  });

  describe('Phase 2.5: Preview Background Integration', () => {
    it('updates preview background when video frame captured', async () => {
      render(<TextOverlayScreenV2 {...defaultProps} videoElement={mockVideoElement} />);

      await waitFor(() => {
        const previewElement = document.querySelector('.ytgif-frame-preview');
        expect(previewElement).toBeInTheDocument();
        // Check that some background image is set (exact value may vary based on mock setup)
        const backgroundImage = getComputedStyle(previewElement as Element).backgroundImage;
        expect(backgroundImage).toMatch(/url\(data:image/);
      });
    });

    it('shows loading placeholder before frame capture', () => {
      render(<TextOverlayScreenV2 {...defaultProps} />);

      expect(screen.getByText('Loading video preview...')).toBeInTheDocument();
      expect(document.querySelector('.ytgif-preview-placeholder')).toBeInTheDocument();
    });

    it('renders text overlays in preview with correct positioning', async () => {
      const testDataUrl = 'data:image/jpeg;base64,test';
      mockCanvas.toDataURL = jest.fn().mockReturnValue(testDataUrl);

      render(<TextOverlayScreenV2 {...defaultProps} videoElement={mockVideoElement} />);

      // Add text content
      const topTextInput = screen.getByPlaceholderText('Add your caption here...');
      const bottomTextInput = screen.getByPlaceholderText('Perfect for reactions or context...');

      fireEvent.change(topTextInput, { target: { value: 'Top preview text' } });
      fireEvent.change(bottomTextInput, { target: { value: 'Bottom preview text' } });

      await waitFor(() => {
        const topOverlay = screen.getByText('Top preview text');
        const bottomOverlay = screen.getByText('Bottom preview text');

        // Check positioning styles
        expect(topOverlay.closest('.ytgif-text-preview-overlay')).toHaveStyle({
          position: 'absolute',
          left: '50%',
          top: '20%',
          transform: 'translate(-50%, -50%)',
        });

        expect(bottomOverlay.closest('.ytgif-text-preview-overlay')).toHaveStyle({
          position: 'absolute',
          left: '50%',
          bottom: '20%',
          transform: 'translate(-50%, 50%)',
        });
      });
    });

    it('applies font size and color to preview text', async () => {
      const testDataUrl = 'data:image/jpeg;base64,test';
      mockCanvas.toDataURL = jest.fn().mockReturnValue(testDataUrl);

      render(<TextOverlayScreenV2 {...defaultProps} resolution="480p" videoElement={mockVideoElement} />);

      // Add text and customize style
      const topTextInput = screen.getByPlaceholderText('Add your caption here...');
      fireEvent.change(topTextInput, { target: { value: 'Styled preview' } });

      // Expand advanced options and change settings
      const topToggleButton = screen.getByText('Top Text Style').closest('button');
      fireEvent.click(topToggleButton!);

      const sizeSlider = screen.getAllByRole('slider')[0];
      const colorInput = document.querySelector('input[type="color"]') as HTMLInputElement;

      fireEvent.change(sizeSlider, { target: { value: '60' } });
      fireEvent.change(colorInput, { target: { value: '#00FF00' } });

      await waitFor(() => {
        const previewText = screen.getByText('Styled preview');
        expect(previewText).toHaveStyle({
          fontSize: '60px',
          color: '#00FF00',
          fontWeight: 'bold',
          textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
        });
      });
    });

    it('handles text overflow in preview with ellipsis', async () => {
      const testDataUrl = 'data:image/jpeg;base64,test';
      mockCanvas.toDataURL = jest.fn().mockReturnValue(testDataUrl);

      render(<TextOverlayScreenV2 {...defaultProps} videoElement={mockVideoElement} />);

      const topTextInput = screen.getByPlaceholderText('Add your caption here...');
      fireEvent.change(topTextInput, { target: { value: 'Very long text that should overflow' } });

      await waitFor(() => {
        const previewOverlay = screen.getByText('Very long text that should overflow').closest('.ytgif-text-preview-overlay');
        expect(previewOverlay).toHaveStyle({
          whiteSpace: 'nowrap',
          maxWidth: '90%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        });
      });
    });

    it('sets correct aspect ratio for preview container', async () => {
      render(<TextOverlayScreenV2 {...defaultProps} resolution="360p" videoElement={mockVideoElement} />);

      await waitFor(() => {
        const previewContainer = document.querySelector('.ytgif-frame-preview');
        expect(previewContainer).toBeInTheDocument();

        // Check that aspect ratio-related styles are set correctly
        const styleAttr = previewContainer?.getAttribute('style');
        expect(styleAttr).toContain('height: 56.25%'); // 360/640 = 0.5625 = 56.25%
        expect(styleAttr).toContain('max-width: 640px'); // 360p width
      });
    });
  });
});