import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
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
      act(() => {
        jest.advanceTimersByTime(1000);
      });

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

  describe('Animation Behavior', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest.useFakeTimers();
      jest.spyOn(global, 'setInterval');
      jest.spyOn(global, 'clearInterval');
    });

    afterEach(() => {
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it('should animate dots in a cycle every 500ms', () => {
      const { unmount } = render(
        <ProcessingScreen
          processingStatus={{
            stage: 'CAPTURING',
            stageNumber: 1,
            totalStages: 4,
            progress: 25,
            message: 'Processing...',
          }}
          onComplete={mockOnComplete}
          onError={mockOnError}
        />
      );

      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 500);

      // The dots animation is internal state, so we test the interval setup
      // and cleanup rather than the visual state changes
      expect(setInterval).toHaveBeenCalledTimes(1);

      unmount();
      expect(clearInterval).toHaveBeenCalledTimes(1);
    });

    it('should clear interval on component unmount', () => {
      const { unmount } = render(
        <ProcessingScreen
          processingStatus={{
            stage: 'CAPTURING',
            stageNumber: 1,
            totalStages: 4,
            progress: 25,
            message: 'Processing...',
          }}
          onComplete={mockOnComplete}
          onError={mockOnError}
        />
      );

      const intervalId = (setInterval as jest.Mock).mock.results[0].value;

      unmount();

      expect(clearInterval).toHaveBeenCalledWith(intervalId);
    });

    it('should reset animation when component remounts', () => {
      const { unmount } = render(
        <ProcessingScreen
          processingStatus={{
            stage: 'CAPTURING',
            stageNumber: 1,
            totalStages: 4,
            progress: 25,
            message: 'Processing...',
          }}
          onComplete={mockOnComplete}
          onError={mockOnError}
        />
      );

      unmount();
      expect(clearInterval).toHaveBeenCalledTimes(1);

      // Remount and verify new interval is created
      render(
        <ProcessingScreen
          processingStatus={{
            stage: 'ANALYZING',
            stageNumber: 2,
            totalStages: 4,
            progress: 50,
            message: 'Processing...',
          }}
          onComplete={mockOnComplete}
          onError={mockOnError}
        />
      );

      expect(setInterval).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge Cases and Performance', () => {
    it('should handle negative stageNumber gracefully', () => {
      render(
        <ProcessingScreen
          processingStatus={{
            stage: 'CAPTURING',
            stageNumber: -1,
            totalStages: 4,
            progress: 25,
            message: 'Processing...',
          }}
          onComplete={mockOnComplete}
          onError={mockOnError}
        />
      );

      // Should not crash and should display some reasonable state
      expect(screen.getByText('Creating Your GIF')).toBeInTheDocument();
      expect(screen.getByText('Processing...')).toBeInTheDocument();
    });

    it('should handle stageNumber exceeding totalStages', () => {
      render(
        <ProcessingScreen
          processingStatus={{
            stage: 'CAPTURING',
            stageNumber: 10,
            totalStages: 4,
            progress: 25,
            message: 'Processing...',
          }}
          onComplete={mockOnComplete}
          onError={mockOnError}
        />
      );

      // Should not crash and display stage info
      expect(screen.getByText('Stage 10 of 4')).toBeInTheDocument();
      expect(screen.getByText('Processing...')).toBeInTheDocument();
    });

    it('should handle zero or negative totalStages', () => {
      const { rerender } = render(
        <ProcessingScreen
          processingStatus={{
            stage: 'CAPTURING',
            stageNumber: 1,
            totalStages: 0,
            progress: 25,
            message: 'Processing...',
          }}
          onComplete={mockOnComplete}
          onError={mockOnError}
        />
      );

      // Component uses || operator, so 0 defaults to 4
      expect(screen.getByText('Stage 1 of 4')).toBeInTheDocument();

      // Test negative totalStages (should display the negative value)
      rerender(
        <ProcessingScreen
          processingStatus={{
            stage: 'CAPTURING',
            stageNumber: 1,
            totalStages: -1,
            progress: 25,
            message: 'Processing...',
          }}
          onComplete={mockOnComplete}
          onError={mockOnError}
        />
      );

      expect(screen.getByText('Stage 1 of -1')).toBeInTheDocument();
    });

    it('should handle unknown stage names', () => {
      render(
        <ProcessingScreen
          processingStatus={{
            stage: 'UNKNOWN_STAGE',
            stageNumber: 1,
            totalStages: 4,
            progress: 25,
            message: 'Processing...',
          }}
          onComplete={mockOnComplete}
          onError={mockOnError}
        />
      );

      // Should render without crashing
      expect(screen.getByText('Creating Your GIF')).toBeInTheDocument();
      expect(screen.getByText('Stage 1 of 4')).toBeInTheDocument();
    });

    it('should handle extremely long messages', () => {
      const longMessage = 'A'.repeat(1000);

      render(
        <ProcessingScreen
          processingStatus={{
            stage: 'CAPTURING',
            stageNumber: 1,
            totalStages: 4,
            progress: 25,
            message: longMessage,
          }}
          onComplete={mockOnComplete}
          onError={mockOnError}
        />
      );

      expect(screen.getByText(longMessage)).toBeInTheDocument();
    });

    it('should handle empty/null message values', () => {
      // Test empty message
      const { rerender } = render(
        <ProcessingScreen
          processingStatus={{
            stage: 'CAPTURING',
            stageNumber: 1,
            totalStages: 4,
            progress: 25,
            message: '',
          }}
          onComplete={mockOnComplete}
          onError={mockOnError}
        />
      );

      // Component uses || operator, so empty string defaults to 'Initializing...'
      expect(screen.getByText('Initializing...')).toBeInTheDocument();

      // Test with undefined message (should use default)
      rerender(
        <ProcessingScreen
          processingStatus={{
            stage: 'CAPTURING',
            stageNumber: 1,
            totalStages: 4,
            progress: 25,
            message: undefined as any,
          }}
          onComplete={mockOnComplete}
          onError={mockOnError}
        />
      );

      expect(screen.getByText('Initializing...')).toBeInTheDocument();
    });

    it('should not call onComplete multiple times for same progress', async () => {
      const { rerender } = render(
        <ProcessingScreen
          processingStatus={{
            stage: 'FINALIZING',
            stageNumber: 4,
            totalStages: 4,
            progress: 100,
            message: 'Complete!',
          }}
          onComplete={mockOnComplete}
          onError={mockOnError}
        />
      );

      act(() => {
        jest.advanceTimersByTime(1000);
      });
      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledTimes(1);
      });

      // Re-render with same 100% progress
      rerender(
        <ProcessingScreen
          processingStatus={{
            stage: 'FINALIZING',
            stageNumber: 4,
            totalStages: 4,
            progress: 100,
            message: 'Still complete!',
          }}
          onComplete={mockOnComplete}
          onError={mockOnError}
        />
      );

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Should still only be called once
      expect(mockOnComplete).toHaveBeenCalledTimes(1);
    });

    it('should handle completion when onComplete is undefined', () => {
      render(
        <ProcessingScreen
          processingStatus={{
            stage: 'FINALIZING',
            stageNumber: 4,
            totalStages: 4,
            progress: 100,
            message: 'Complete!',
          }}
          onComplete={undefined}
          onError={mockOnError}
        />
      );

      // Should not throw error
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      expect(() => {
        act(() => {
          jest.advanceTimersByTime(1000);
        });
      }).not.toThrow();
    });

    it('should not call onError prop (documented unused parameter)', () => {
      render(
        <ProcessingScreen
          processingStatus={{
            stage: 'ERROR',
            stageNumber: 2,
            totalStages: 4,
            progress: 0,
            message: 'Something went wrong',
          }}
          onComplete={mockOnComplete}
          onError={mockOnError}
        />
      );

      // Verify onError is never called even in error state
      expect(mockOnError).not.toHaveBeenCalled();

      // This documents that onError is intentionally unused
      // The component displays error state but doesn't call the callback
    });

    it('should handle rapid progress updates without performance issues', async () => {
      const { rerender } = render(
        <ProcessingScreen
          processingStatus={{
            stage: 'CAPTURING',
            stageNumber: 1,
            totalStages: 4,
            progress: 0,
            message: 'Starting...',
          }}
          onComplete={mockOnComplete}
          onError={mockOnError}
        />
      );

      // Rapidly update progress from 0 to 100
      for (let i = 1; i <= 100; i++) {
        rerender(
          <ProcessingScreen
            processingStatus={{
              stage: i === 100 ? 'COMPLETED' : 'CAPTURING',
              stageNumber: Math.ceil(i / 25),
              totalStages: 4,
              progress: i,
              message: `Progress: ${i}%`,
            }}
            onComplete={mockOnComplete}
            onError={mockOnError}
          />
        );
      }

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Should only call onComplete once despite rapid updates
      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle rapid stage transitions', () => {
      const stages = ['CAPTURING', 'ANALYZING', 'ENCODING', 'FINALIZING'];
      const { rerender } = render(
        <ProcessingScreen
          processingStatus={{
            stage: 'CAPTURING',
            stageNumber: 1,
            totalStages: 4,
            progress: 25,
            message: 'Starting...',
          }}
          onComplete={mockOnComplete}
          onError={mockOnError}
        />
      );

      // Rapidly cycle through all stages multiple times
      for (let cycle = 0; cycle < 3; cycle++) {
        stages.forEach((stage, index) => {
          rerender(
            <ProcessingScreen
              processingStatus={{
                stage,
                stageNumber: index + 1,
                totalStages: 4,
                progress: (index + 1) * 25,
                message: `Stage: ${stage}`,
              }}
              onComplete={mockOnComplete}
              onError={mockOnError}
            />
          );
        });
      }

      // Should render final state correctly
      expect(screen.getByText('Stage: FINALIZING')).toBeInTheDocument();
      expect(screen.getByText('Stage 4 of 4')).toBeInTheDocument();
    });
  });
});
