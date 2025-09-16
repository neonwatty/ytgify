import { describe, it, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';
import { AdvancedProcessingPanel } from '@/editor/controls/advanced-panel';
import type { GifSettings, TimelineSelection } from '@/types';

// Mock dependencies
jest.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' ')
}));

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  )
}));

jest.mock('@/components/ui/input', () => ({
  Input: ({ ...props }: any) => <input {...props} />
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
  CardDescription: ({ children }: any) => <div data-testid="card-description">{children}</div>,
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: any) => <div data-testid="card-title">{children}</div>
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange, disabled }: any) => (
    <select
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      disabled={disabled}
      data-testid="select"
    >
      {children}
    </select>
  ),
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: any) => <>{children}</>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>
}));

jest.mock('@/components/ui/alert', () => ({
  Alert: ({ children }: any) => <div data-testid="alert">{children}</div>,
  AlertDescription: ({ children }: any) => <div data-testid="alert-description">{children}</div>
}));

// Mock QualityManager
const mockQualityManager = {
  analyzeContent: jest.fn(),
  getQualitySummary: jest.fn(),
  optimizeForFileSize: jest.fn()
};

jest.mock('@/processing/quality-manager', () => ({
  QualityManager: jest.fn(() => mockQualityManager),
  FRAME_RATE_PROFILES: [
    {
      fps: 8,
      name: 'Cinematic',
      description: 'Smooth, film-like motion',
      suitableFor: ['Movies', 'Artistic content']
    },
    {
      fps: 12,
      name: 'Standard',
      description: 'Balanced quality and size',
      suitableFor: ['General use', 'Social media']
    },
    {
      fps: 15,
      name: 'High',
      description: 'Higher quality animation',
      suitableFor: ['Detailed animations', 'Action scenes']
    },
    {
      fps: 24,
      name: 'Ultra',
      description: 'Maximum smoothness',
      suitableFor: ['Gaming', 'Sports']
    }
  ],
  QUALITY_PROFILES: [
    { name: 'Low', description: 'Small file size' },
    { name: 'Medium', description: 'Balanced' },
    { name: 'High', description: 'Best quality' }
  ]
}));

describe('AdvancedProcessingPanel', () => {
  let mockSettings: Partial<GifSettings>;
  let mockOnSettingsChange: jest.Mock;
  let mockSelection: TimelineSelection;
  let mockVideoMetadata: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSettings = {
      frameRate: 15,
      quality: 'medium',
      resolution: '720p',
      startTime: 0,
      endTime: 5
    };

    mockOnSettingsChange = jest.fn();

    mockSelection = {
      startTime: 0,
      endTime: 5,
      duration: 5
    };

    mockVideoMetadata = {
      originalFrameRate: 30,
      resolution: { width: 1920, height: 1080 },
      bitrate: 5000000
    };

    // Default mock returns
    mockQualityManager.analyzeContent.mockReturnValue({
      recommendedFrameRate: 12,
      recommendedQuality: 'medium',
      recommendedResolution: '720p',
      reasoning: [
        'Standard motion content detected',
        'Balanced quality for web sharing'
      ]
    });

    mockQualityManager.getQualitySummary.mockReturnValue({
      estimatedFileSize: '2.5 MB',
      estimatedEncodingTime: '10 seconds',
      frameRateProfile: {
        name: 'High',
        description: 'Higher quality animation'
      },
      qualityProfile: {
        name: 'Medium',
        description: 'Balanced'
      },
      recommendations: []
    });

    mockQualityManager.optimizeForFileSize.mockReturnValue({
      optimizedSettings: {
        frameRate: 10,
        quality: 'low',
        resolution: '480p'
      },
      estimatedFileSize: 1024 * 1024, // 1MB
      reductionSteps: [
        'Reduced frame rate from 15 to 10 fps',
        'Lowered quality to reduce colors',
        'Reduced resolution to 480p'
      ]
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render all main sections', () => {
      render(
        <AdvancedProcessingPanel
          settings={mockSettings}
          onSettingsChange={mockOnSettingsChange}
          selection={mockSelection}
          videoMetadata={mockVideoMetadata}
        />
      );

      expect(screen.getByText('Frame Rate Profiles')).toBeInTheDocument();
      expect(screen.getByText('File Size Optimization')).toBeInTheDocument();
    });

    it('should show recommendations when available', () => {
      render(
        <AdvancedProcessingPanel
          settings={mockSettings}
          onSettingsChange={mockOnSettingsChange}
          selection={mockSelection}
          videoMetadata={mockVideoMetadata}
        />
      );

      expect(screen.getByText('Smart Recommendations')).toBeInTheDocument();
      expect(screen.getByText('12 fps')).toBeInTheDocument();
      expect(screen.getByText('Standard motion content detected')).toBeInTheDocument();
      expect(screen.getByText('Balanced quality for web sharing')).toBeInTheDocument();
    });

    it('should show quality summary when settings are complete', () => {
      render(
        <AdvancedProcessingPanel
          settings={mockSettings}
          onSettingsChange={mockOnSettingsChange}
          selection={mockSelection}
          videoMetadata={mockVideoMetadata}
        />
      );

      expect(screen.getByText('Processing Preview')).toBeInTheDocument();
      expect(screen.getByText('2.5 MB')).toBeInTheDocument();
      expect(screen.getByText('10 seconds')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(
        <AdvancedProcessingPanel
          settings={mockSettings}
          onSettingsChange={mockOnSettingsChange}
          className="custom-panel"
        />
      );

      expect(container.firstChild).toHaveClass('custom-panel');
    });
  });

  describe('Smart Recommendations', () => {
    it('should analyze content when selection changes', () => {
      const { rerender } = render(
        <AdvancedProcessingPanel
          settings={mockSettings}
          onSettingsChange={mockOnSettingsChange}
          selection={mockSelection}
          videoMetadata={mockVideoMetadata}
        />
      );

      const newSelection = { ...mockSelection, endTime: 10 };
      rerender(
        <AdvancedProcessingPanel
          settings={mockSettings}
          onSettingsChange={mockOnSettingsChange}
          selection={newSelection}
          videoMetadata={mockVideoMetadata}
        />
      );

      expect(mockQualityManager.analyzeContent).toHaveBeenCalledWith(
        newSelection,
        mockVideoMetadata
      );
    });

    it('should apply recommended settings when button clicked', () => {
      render(
        <AdvancedProcessingPanel
          settings={mockSettings}
          onSettingsChange={mockOnSettingsChange}
          selection={mockSelection}
          videoMetadata={mockVideoMetadata}
        />
      );

      const applyButton = screen.getByText('Apply Recommended Settings');
      fireEvent.click(applyButton);

      expect(mockOnSettingsChange).toHaveBeenCalledWith({
        frameRate: 12,
        quality: 'medium',
        resolution: '720p'
      });
    });

    it('should display multiple reasoning points', () => {
      mockQualityManager.analyzeContent.mockReturnValue({
        recommendedFrameRate: 24,
        recommendedQuality: 'high',
        recommendedResolution: '1080p',
        reasoning: [
          'Fast motion detected',
          'High detail content',
          'Optimal for gaming content'
        ]
      });

      render(
        <AdvancedProcessingPanel
          settings={mockSettings}
          onSettingsChange={mockOnSettingsChange}
          selection={mockSelection}
          videoMetadata={mockVideoMetadata}
        />
      );

      expect(screen.getByText('Fast motion detected')).toBeInTheDocument();
      expect(screen.getByText('High detail content')).toBeInTheDocument();
      expect(screen.getByText('Optimal for gaming content')).toBeInTheDocument();
    });
  });

  describe('Frame Rate Profiles', () => {
    it('should display frame rate profile options', () => {
      render(
        <AdvancedProcessingPanel
          settings={mockSettings}
          onSettingsChange={mockOnSettingsChange}
        />
      );

      const select = screen.getByTestId('select') as HTMLSelectElement;
      const options = select.querySelectorAll('option');

      expect(options).toHaveLength(4);
      expect(options[0].textContent).toContain('8 fps');
      expect(options[0].textContent).toContain('Cinematic');
    });

    it('should show current profile description', () => {
      render(
        <AdvancedProcessingPanel
          settings={mockSettings}
          onSettingsChange={mockOnSettingsChange}
        />
      );

      expect(screen.getByText(/Higher quality animation/)).toBeInTheDocument();
    });

    it('should update frame rate when profile selected', () => {
      render(
        <AdvancedProcessingPanel
          settings={mockSettings}
          onSettingsChange={mockOnSettingsChange}
        />
      );

      const select = screen.getByTestId('select');
      fireEvent.change(select, { target: { value: '24' } });

      expect(mockOnSettingsChange).toHaveBeenCalledWith({ frameRate: 24 });
    });

    it('should display suitable content types for profile', () => {
      render(
        <AdvancedProcessingPanel
          settings={{ ...mockSettings, frameRate: 8 }}
          onSettingsChange={mockOnSettingsChange}
        />
      );

      expect(screen.getByText(/Movies, Artistic content/)).toBeInTheDocument();
    });
  });

  describe('File Size Optimization', () => {
    it('should enable optimize button when target size entered', () => {
      render(
        <AdvancedProcessingPanel
          settings={mockSettings}
          onSettingsChange={mockOnSettingsChange}
        />
      );

      const input = screen.getByPlaceholderText('Target size (MB)');
      const button = screen.getByText('Optimize');

      expect(button).toBeDisabled();

      fireEvent.change(input, { target: { value: '2' } });

      expect(button).not.toBeDisabled();
    });

    it('should show optimization results', async () => {
      render(
        <AdvancedProcessingPanel
          settings={mockSettings}
          onSettingsChange={mockOnSettingsChange}
        />
      );

      const input = screen.getByPlaceholderText('Target size (MB)');
      const button = screen.getByText('Optimize');

      fireEvent.change(input, { target: { value: '1' } });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText('Optimized for 1.0 MB')).toBeInTheDocument();
        expect(screen.getByText('Reduced frame rate from 15 to 10 fps')).toBeInTheDocument();
        expect(screen.getByText('Lowered quality to reduce colors')).toBeInTheDocument();
      });
    });

    it('should apply optimized settings', async () => {
      render(
        <AdvancedProcessingPanel
          settings={mockSettings}
          onSettingsChange={mockOnSettingsChange}
        />
      );

      const input = screen.getByPlaceholderText('Target size (MB)');
      const optimizeButton = screen.getByText('Optimize');

      fireEvent.change(input, { target: { value: '1' } });
      fireEvent.click(optimizeButton);

      await waitFor(() => {
        const applyButton = screen.getByText('Apply Optimization');
        fireEvent.click(applyButton);
      });

      expect(mockOnSettingsChange).toHaveBeenCalledWith({
        frameRate: 10,
        quality: 'low',
        resolution: '480p'
      });
    });

    it('should dismiss optimization results', async () => {
      render(
        <AdvancedProcessingPanel
          settings={mockSettings}
          onSettingsChange={mockOnSettingsChange}
        />
      );

      const input = screen.getByPlaceholderText('Target size (MB)');
      const optimizeButton = screen.getByText('Optimize');

      fireEvent.change(input, { target: { value: '1' } });
      fireEvent.click(optimizeButton);

      await waitFor(() => {
        const dismissButton = screen.getByText('Dismiss');
        fireEvent.click(dismissButton);
      });

      expect(screen.queryByText('Optimized for 1.0 MB')).not.toBeInTheDocument();
    });
  });

  describe('Quality Summary', () => {
    it('should display estimated file size and encoding time', () => {
      render(
        <AdvancedProcessingPanel
          settings={mockSettings}
          onSettingsChange={mockOnSettingsChange}
        />
      );

      expect(screen.getByText('File Size')).toBeInTheDocument();
      expect(screen.getByText('2.5 MB')).toBeInTheDocument();
      expect(screen.getByText('Encoding Time')).toBeInTheDocument();
      expect(screen.getByText('10 seconds')).toBeInTheDocument();
    });

    it('should show current profile information', () => {
      render(
        <AdvancedProcessingPanel
          settings={mockSettings}
          onSettingsChange={mockOnSettingsChange}
        />
      );

      expect(screen.getByText(/High • Medium/)).toBeInTheDocument();
    });

    it('should display suggestions when available', () => {
      mockQualityManager.getQualitySummary.mockReturnValue({
        estimatedFileSize: '5 MB',
        estimatedEncodingTime: '20 seconds',
        frameRateProfile: { name: 'Ultra', description: 'Maximum smoothness' },
        qualityProfile: { name: 'High', description: 'Best quality' },
        recommendations: [
          'Consider reducing frame rate for smaller file size',
          'Enable optimization for web sharing'
        ]
      });

      render(
        <AdvancedProcessingPanel
          settings={mockSettings}
          onSettingsChange={mockOnSettingsChange}
        />
      );

      expect(screen.getByText('Suggestions')).toBeInTheDocument();
      expect(screen.getByText('Consider reducing frame rate for smaller file size')).toBeInTheDocument();
      expect(screen.getByText('Enable optimization for web sharing')).toBeInTheDocument();
    });

    it('should not show summary with incomplete settings', () => {
      render(
        <AdvancedProcessingPanel
          settings={{ frameRate: 15 }} // Missing other required settings
          onSettingsChange={mockOnSettingsChange}
        />
      );

      expect(screen.queryByText('Processing Preview')).not.toBeInTheDocument();
    });
  });

  describe('Disabled State', () => {
    it('should disable all controls when disabled prop is true', () => {
      render(
        <AdvancedProcessingPanel
          settings={mockSettings}
          onSettingsChange={mockOnSettingsChange}
          disabled={true}
        />
      );

      const applyButton = screen.getByText('Apply Recommended Settings');
      const select = screen.getByTestId('select');
      const optimizeButton = screen.getByText('Optimize');

      expect(applyButton).toBeDisabled();
      expect(select).toBeDisabled();
      expect(optimizeButton).toBeDisabled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle invalid target file size', () => {
      render(
        <AdvancedProcessingPanel
          settings={mockSettings}
          onSettingsChange={mockOnSettingsChange}
        />
      );

      const input = screen.getByPlaceholderText('Target size (MB)');
      const button = screen.getByText('Optimize');

      fireEvent.change(input, { target: { value: '-5' } });
      fireEvent.click(button);

      expect(mockQualityManager.optimizeForFileSize).not.toHaveBeenCalled();
    });

    it('should handle missing video metadata', () => {
      render(
        <AdvancedProcessingPanel
          settings={mockSettings}
          onSettingsChange={mockOnSettingsChange}
          selection={mockSelection}
          videoMetadata={undefined}
        />
      );

      expect(mockQualityManager.analyzeContent).toHaveBeenCalledWith(
        mockSelection,
        undefined
      );
    });

    it('should handle optimization with tolerance', () => {
      render(
        <AdvancedProcessingPanel
          settings={mockSettings}
          onSettingsChange={mockOnSettingsChange}
        />
      );

      const input = screen.getByPlaceholderText('Target size (MB)');
      const button = screen.getByText('Optimize');

      fireEvent.change(input, { target: { value: '3' } });
      fireEvent.click(button);

      expect(mockQualityManager.optimizeForFileSize).toHaveBeenCalledWith(
        mockSettings,
        3 * 1024 * 1024, // 3MB in bytes
        10 // 10% tolerance
      );
    });
  });
});