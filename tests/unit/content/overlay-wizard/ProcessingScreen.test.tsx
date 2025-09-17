import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProcessingScreen from '../../../../src/content/overlay-wizard/screens/ProcessingScreen';

describe('ProcessingScreen', () => {
  const mockOnComplete = jest.fn();
  const mockOnError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Stage Display', () => {
    it('should display all 4 stages with correct icons and names', () => {
      render(
        <ProcessingScreen
          processingStatus={{
            stage: 'CAPTURING',
            stageNumber: 1,
            totalStages: 4,
            progress: 25,
            message: 'Reading video data...',
          }}
          onComplete={mockOnComplete}
          onError={mockOnError}
        />
      );

      expect(screen.getByText('📹')).toBeInTheDocument();
      expect(screen.getByText('Capturing Frames')).toBeInTheDocument();
      expect(screen.getByText('🎨')).toBeInTheDocument();
      expect(screen.getByText('Analyzing Colors')).toBeInTheDocument();
      expect(screen.getByText('🔧')).toBeInTheDocument();
      expect(screen.getByText('Encoding GIF')).toBeInTheDocument();
      expect(screen.getByText('✨')).toBeInTheDocument();
      expect(screen.getByText('Finalizing')).toBeInTheDocument();
    });

    it('should show current stage as active with bullet indicator', () => {
      render(
        <ProcessingScreen
          processingStatus={{
            stage: 'ANALYZING',
            stageNumber: 2,
            totalStages: 4,
            progress: 50,
            message: 'Optimizing color palette...',
          }}
          onComplete={mockOnComplete}
          onError={mockOnError}
        />
      );

      const stageItems = screen.getAllByText('●');
      expect(stageItems).toHaveLength(1); // Only current stage should have bullet

      const currentStageItem = screen.getByText('Analyzing Colors').closest('.ytgif-stage-item');
      expect(currentStageItem).toHaveClass('current');
    });

    it('should mark completed stages with checkmarks', () => {
      render(
        <ProcessingScreen
          processingStatus={{
            stage: 'ENCODING',
            stageNumber: 3,
            totalStages: 4,
            progress: 75,
            message: 'Encoding frames...',
          }}
          onComplete={mockOnComplete}
          onError={mockOnError}
        />
      );

      const checkmarks = screen.getAllByText('✓');
      expect(checkmarks).toHaveLength(2); // First two stages completed

      const capturingStage = screen.getByText('Capturing Frames').closest('.ytgif-stage-item');
      expect(capturingStage).toHaveClass('completed');

      const analyzingStage = screen.getByText('Analyzing Colors').closest('.ytgif-stage-item');
      expect(analyzingStage).toHaveClass('completed');
    });

    it('should mark pending stages with circle indicators', () => {
      render(
        <ProcessingScreen
          processingStatus={{
            stage: 'CAPTURING',
            stageNumber: 1,
            totalStages: 4,
            progress: 25,
            message: 'Reading video data...',
          }}
          onComplete={mockOnComplete}
          onError={mockOnError}
        />
      );

      const pendingIndicators = screen.getAllByText('○');
      expect(pendingIndicators).toHaveLength(3); // Last three stages pending
    });
  });

  describe('Error State Handling', () => {
    it('should display error state correctly', () => {
      render(
        <ProcessingScreen
          processingStatus={{
            stage: 'ERROR',
            stageNumber: 2,
            totalStages: 4,
            progress: 0,
            message: 'Failed to analyze colors',
          }}
          onComplete={mockOnComplete}
          onError={mockOnError}
        />
      );

      expect(screen.getByText('GIF Creation Failed')).toBeInTheDocument();
      expect(screen.getByText('Error occurred')).toBeInTheDocument();
      expect(screen.getByText('Failed to analyze colors')).toBeInTheDocument();

      // Should show error indicator on current stage
      const errorIndicators = screen.getAllByText('✗');
      expect(errorIndicators).toHaveLength(1);

      // Should show completed stages as completed
      const checkmarks = screen.getAllByText('✓');
      expect(checkmarks).toHaveLength(1); // First stage was completed
    });

    it('should handle error at stage 0 correctly', () => {
      render(
        <ProcessingScreen
          processingStatus={{
            stage: 'ERROR',
            stageNumber: 0,
            totalStages: 4,
            progress: 0,
            message: 'Failed to start capture',
          }}
          onComplete={mockOnComplete}
          onError={mockOnError}
        />
      );

      // First stage should show error
      const errorIndicators = screen.getAllByText('✗');
      expect(errorIndicators).toHaveLength(1);

      // No stages should be completed
      const checkmarks = screen.queryAllByText('✓');
      expect(checkmarks).toHaveLength(0);
    });

    it('should not show loading dots in error state', () => {
      render(
        <ProcessingScreen
          processingStatus={{
            stage: 'ERROR',
            stageNumber: 2,
            totalStages: 4,
            progress: 0,
            message: 'Processing failed',
          }}
          onComplete={mockOnComplete}
          onError={mockOnError}
        />
      );

      const loadingDots = screen.queryByTestId('loading-dots');
      expect(loadingDots).not.toBeInTheDocument();
    });
  });

  describe('Completion State', () => {
    it('should display completion state correctly', () => {
      render(
        <ProcessingScreen
          processingStatus={{
            stage: 'COMPLETED',
            stageNumber: 4,
            totalStages: 4,
            progress: 100,
            message: 'GIF created successfully!',
          }}
          onComplete={mockOnComplete}
          onError={mockOnError}
        />
      );

      expect(screen.getByText('GIF Created!')).toBeInTheDocument();
      expect(screen.getByText('All stages complete')).toBeInTheDocument();

      // All stages should show as completed
      const checkmarks = screen.getAllByText('✓');
      expect(checkmarks).toHaveLength(4);
    });

    it('should call onComplete when progress reaches 100%', async () => {
      const { rerender } = render(
        <ProcessingScreen
          processingStatus={{
            stage: 'ENCODING',
            stageNumber: 3,
            totalStages: 4,
            progress: 75,
            message: 'Almost done...',
          }}
          onComplete={mockOnComplete}
          onError={mockOnError}
        />
      );

      expect(mockOnComplete).not.toHaveBeenCalled();

      // Update to 100% completion
      rerender(
        <ProcessingScreen
          processingStatus={{
            stage: 'COMPLETED',
            stageNumber: 4,
            totalStages: 4,
            progress: 100,
            message: 'Complete!',
          }}
          onComplete={mockOnComplete}
          onError={mockOnError}
        />
      );

      // Fast forward the timeout
      jest.advanceTimersByTime(1000);

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledTimes(1);
      });
    });

    it('should not show loading dots in completed state', () => {
      render(
        <ProcessingScreen
          processingStatus={{
            stage: 'COMPLETED',
            stageNumber: 4,
            totalStages: 4,
            progress: 100,
            message: 'GIF created successfully!',
          }}
          onComplete={mockOnComplete}
          onError={mockOnError}
        />
      );

      const loadingDots = screen.queryByTestId('loading-dots');
      expect(loadingDots).not.toBeInTheDocument();
    });
  });

  describe('Default Values', () => {
    it('should handle missing processingStatus with defaults', () => {
      render(<ProcessingScreen onComplete={mockOnComplete} onError={mockOnError} />);

      expect(screen.getByText('Creating Your GIF')).toBeInTheDocument();
      expect(screen.getByText('Stage 1 of 4')).toBeInTheDocument();
      expect(screen.getByText('Initializing...')).toBeInTheDocument();
    });

    it('should handle partial processingStatus', () => {
      render(
        <ProcessingScreen
          processingStatus={{
            stage: 'ANALYZING',
            stageNumber: 2,
            totalStages: 4,
            progress: 50,
            message: 'Working...',
          }}
          onComplete={mockOnComplete}
          onError={mockOnError}
        />
      );

      expect(screen.getByText('Stage 2 of 4')).toBeInTheDocument();
      expect(screen.getByText('Working...')).toBeInTheDocument();
    });
  });

  describe('Loading Animation', () => {
    it('should show loading dots when processing', () => {
      render(
        <ProcessingScreen
          processingStatus={{
            stage: 'CAPTURING',
            stageNumber: 1,
            totalStages: 4,
            progress: 25,
            message: 'Reading video data...',
          }}
          onComplete={mockOnComplete}
          onError={mockOnError}
        />
      );

      const loadingDotsContainer = screen.getByText('Reading video data...').nextElementSibling;
      expect(loadingDotsContainer).toHaveClass('ytgif-loading-dots');

      const dots = screen.getAllByText('⚬');
      expect(dots).toHaveLength(3);
    });
  });
});
