import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProcessingScreen from '../../../../src/content/overlay-wizard/screens/ProcessingScreen';
import * as links from '../../../../src/constants/links';

// Mock the links module
jest.mock('../../../../src/constants/links', () => ({
  openExternalLink: jest.fn(),
  getDiscordLink: jest.fn(() => 'https://discord.gg/8EUxqR93'),
}));

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

    it('should display Discord help button on error', () => {
      render(
        <ProcessingScreen
          processingStatus={{
            stage: 'ERROR',
            stageNumber: 2,
            totalStages: 4,
            progress: 0,
            message: 'Failed to process GIF',
          }}
          onComplete={mockOnComplete}
          onError={mockOnError}
        />
      );

      expect(screen.getByText('Need help? Join our Discord community for support.')).toBeInTheDocument();
      expect(screen.getByText('Get Help on Discord')).toBeInTheDocument();
    });

    it('should not display Discord help button during normal processing', () => {
      render(
        <ProcessingScreen
          processingStatus={{
            stage: 'CAPTURING',
            stageNumber: 1,
            totalStages: 4,
            progress: 25,
            message: 'Capturing frames...',
          }}
          onComplete={mockOnComplete}
          onError={mockOnError}
        />
      );

      expect(screen.queryByText('Need help? Join our Discord community for support.')).not.toBeInTheDocument();
      expect(screen.queryByText('Get Help on Discord')).not.toBeInTheDocument();
    });

    it('should open Discord link when button is clicked', () => {
      render(
        <ProcessingScreen
          processingStatus={{
            stage: 'ERROR',
            stageNumber: 2,
            totalStages: 4,
            progress: 0,
            message: 'Failed to process GIF',
          }}
          onComplete={mockOnComplete}
          onError={mockOnError}
        />
      );

      const discordButton = screen.getByText('Get Help on Discord');
      fireEvent.click(discordButton);

      expect(links.openExternalLink).toHaveBeenCalledWith('https://discord.gg/8EUxqR93');
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
      expect(screen.getAllByText('Initializing...')[0]).toBeInTheDocument();
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
      expect(screen.getAllByText('Initializing...')[0]).toBeInTheDocument();

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

      expect(screen.getAllByText('Initializing...')[0]).toBeInTheDocument();
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

  describe('Buffering Status Display (Phase 1.1)', () => {
    const createBufferingStatus = (overrides = {}) => ({
      isBuffering: true,
      currentFrame: 25,
      totalFrames: 50,
      bufferedPercentage: 50,
      estimatedTimeRemaining: 5,
      ...overrides,
    });

    describe('Inline Progress Bar', () => {
      it('should render inline progress bar during CAPTURING stage with buffering status', () => {
        render(
          <ProcessingScreen
            processingStatus={{
              stage: 'CAPTURING',
              stageNumber: 1,
              totalStages: 4,
              progress: 50,
              message: 'Capturing frames...',
              bufferingStatus: createBufferingStatus(),
            }}
            onComplete={mockOnComplete}
            onError={mockOnError}
          />
        );

        // Should show frame count
        expect(screen.getByText(/Frame 25\/50/i)).toBeInTheDocument();
      });

      it('should display current frame and total frames', () => {
        render(
          <ProcessingScreen
            processingStatus={{
              stage: 'CAPTURING',
              stageNumber: 1,
              totalStages: 4,
              progress: 30,
              message: 'Capturing...',
              bufferingStatus: createBufferingStatus({ currentFrame: 15, totalFrames: 50 }),
            }}
            onComplete={mockOnComplete}
            onError={mockOnError}
          />
        );

        expect(screen.getByText('Frame 15/50')).toBeInTheDocument();
      });

      it('should show progress fill based on frame ratio', () => {
        const { container } = render(
          <ProcessingScreen
            processingStatus={{
              stage: 'CAPTURING',
              stageNumber: 1,
              totalStages: 4,
              progress: 50,
              message: 'Capturing...',
              bufferingStatus: createBufferingStatus({ currentFrame: 25, totalFrames: 100 }),
            }}
            onComplete={mockOnComplete}
            onError={mockOnError}
          />
        );

        // Progress fill should be 25% width (25/100)
        const progressFill = container.querySelector('.ytgif-inline-progress-fill');
        expect(progressFill).toHaveStyle({ width: '25%' });
      });

      it('should show ETA when estimatedTimeRemaining > 0', () => {
        render(
          <ProcessingScreen
            processingStatus={{
              stage: 'CAPTURING',
              stageNumber: 1,
              totalStages: 4,
              progress: 40,
              message: 'Capturing...',
              bufferingStatus: createBufferingStatus({ estimatedTimeRemaining: 7.3 }),
            }}
            onComplete={mockOnComplete}
            onError={mockOnError}
          />
        );

        // Should round to 8s
        expect(screen.getByText(/~8s/i)).toBeInTheDocument();
      });

      it('should hide ETA when estimatedTimeRemaining is 0', () => {
        render(
          <ProcessingScreen
            processingStatus={{
              stage: 'CAPTURING',
              stageNumber: 1,
              totalStages: 4,
              progress: 40,
              message: 'Capturing...',
              bufferingStatus: createBufferingStatus({ estimatedTimeRemaining: 0 }),
            }}
            onComplete={mockOnComplete}
            onError={mockOnError}
          />
        );

        expect(screen.queryByText(/~\ds/i)).not.toBeInTheDocument();
      });

      it('should display "Initializing..." placeholder when no buffering data', () => {
        render(
          <ProcessingScreen
            processingStatus={{
              stage: 'CAPTURING',
              stageNumber: 1,
              totalStages: 4,
              progress: 10,
              message: 'Starting...',
            }}
            onComplete={mockOnComplete}
            onError={mockOnError}
          />
        );

        expect(screen.getByText('Initializing...')).toBeInTheDocument();
      });
    });

    describe('State Persistence', () => {
      it('should persist bufferingStatus in component state', () => {
        const { rerender } = render(
          <ProcessingScreen
            processingStatus={{
              stage: 'CAPTURING',
              stageNumber: 1,
              totalStages: 4,
              progress: 50,
              message: 'Capturing...',
              bufferingStatus: createBufferingStatus({ currentFrame: 25, totalFrames: 50 }),
            }}
            onComplete={mockOnComplete}
            onError={mockOnError}
          />
        );

        expect(screen.getByText('Frame 25/50')).toBeInTheDocument();

        // Rerender without bufferingStatus
        rerender(
          <ProcessingScreen
            processingStatus={{
              stage: 'CAPTURING',
              stageNumber: 1,
              totalStages: 4,
              progress: 52,
              message: 'Capturing...',
            }}
            onComplete={mockOnComplete}
            onError={mockOnError}
          />
        );

        // Should still show last known frame count
        expect(screen.getByText('Frame 25/50')).toBeInTheDocument();
      });

      it('should update persisted status when new bufferingStatus provided', () => {
        const { rerender } = render(
          <ProcessingScreen
            processingStatus={{
              stage: 'CAPTURING',
              stageNumber: 1,
              totalStages: 4,
              progress: 50,
              message: 'Capturing...',
              bufferingStatus: createBufferingStatus({ currentFrame: 25, totalFrames: 50 }),
            }}
            onComplete={mockOnComplete}
            onError={mockOnError}
          />
        );

        expect(screen.getByText('Frame 25/50')).toBeInTheDocument();

        // Update with new buffering status
        rerender(
          <ProcessingScreen
            processingStatus={{
              stage: 'CAPTURING',
              stageNumber: 1,
              totalStages: 4,
              progress: 60,
              message: 'Capturing...',
              bufferingStatus: createBufferingStatus({ currentFrame: 30, totalFrames: 50 }),
            }}
            onComplete={mockOnComplete}
            onError={mockOnError}
          />
        );

        // Should show updated frame count
        expect(screen.getByText('Frame 30/50')).toBeInTheDocument();
      });

      it('should clear lastBufferingStatus when leaving CAPTURING stage', () => {
        const { rerender } = render(
          <ProcessingScreen
            processingStatus={{
              stage: 'CAPTURING',
              stageNumber: 1,
              totalStages: 4,
              progress: 50,
              message: 'Capturing...',
              bufferingStatus: createBufferingStatus(),
            }}
            onComplete={mockOnComplete}
            onError={mockOnError}
          />
        );

        expect(screen.getByText(/Frame 25\/50/i)).toBeInTheDocument();

        // Move to ENCODING stage
        rerender(
          <ProcessingScreen
            processingStatus={{
              stage: 'ENCODING',
              stageNumber: 3,
              totalStages: 4,
              progress: 75,
              message: 'Encoding...',
            }}
            onComplete={mockOnComplete}
            onError={mockOnError}
          />
        );

        // Buffering status should not be visible
        expect(screen.queryByText(/Frame 25\/50/i)).not.toBeInTheDocument();
      });

      it('should prevent flickering by showing persisted status during gaps', () => {
        const { rerender } = render(
          <ProcessingScreen
            processingStatus={{
              stage: 'CAPTURING',
              stageNumber: 1,
              totalStages: 4,
              progress: 40,
              message: 'Capturing...',
              bufferingStatus: createBufferingStatus({ currentFrame: 20, totalFrames: 50 }),
            }}
            onComplete={mockOnComplete}
            onError={mockOnError}
          />
        );

        // Rapid updates with alternating bufferingStatus
        rerender(
          <ProcessingScreen
            processingStatus={{
              stage: 'CAPTURING',
              stageNumber: 1,
              totalStages: 4,
              progress: 42,
              message: 'Capturing...',
            }}
            onComplete={mockOnComplete}
            onError={mockOnError}
          />
        );

        // Should still show last frame count without flickering to "Initializing..."
        expect(screen.getByText('Frame 20/50')).toBeInTheDocument();
        expect(screen.queryByText('Initializing...')).not.toBeInTheDocument();
      });

      it('should show "Initializing..." only when no buffering data ever received', () => {
        render(
          <ProcessingScreen
            processingStatus={{
              stage: 'CAPTURING',
              stageNumber: 1,
              totalStages: 4,
              progress: 5,
              message: 'Starting capture...',
            }}
            onComplete={mockOnComplete}
            onError={mockOnError}
          />
        );

        expect(screen.getByText('Initializing...')).toBeInTheDocument();
      });
    });

    describe('ETA Display', () => {
      it('should round ETA to nearest second', () => {
        render(
          <ProcessingScreen
            processingStatus={{
              stage: 'CAPTURING',
              stageNumber: 1,
              totalStages: 4,
              progress: 50,
              message: 'Capturing...',
              bufferingStatus: createBufferingStatus({ estimatedTimeRemaining: 4.7 }),
            }}
            onComplete={mockOnComplete}
            onError={mockOnError}
          />
        );

        expect(screen.getByText(/~5s/i)).toBeInTheDocument();
      });

      it('should handle sub-second ETAs', () => {
        render(
          <ProcessingScreen
            processingStatus={{
              stage: 'CAPTURING',
              stageNumber: 1,
              totalStages: 4,
              progress: 90,
              message: 'Capturing...',
              bufferingStatus: createBufferingStatus({ estimatedTimeRemaining: 0.3 }),
            }}
            onComplete={mockOnComplete}
            onError={mockOnError}
          />
        );

        // Should round up to 1s
        expect(screen.getByText(/~1s/i)).toBeInTheDocument();
      });

      it('should handle long ETAs', () => {
        render(
          <ProcessingScreen
            processingStatus={{
              stage: 'CAPTURING',
              stageNumber: 1,
              totalStages: 4,
              progress: 20,
              message: 'Capturing...',
              bufferingStatus: createBufferingStatus({ estimatedTimeRemaining: 45.2 }),
            }}
            onComplete={mockOnComplete}
            onError={mockOnError}
          />
        );

        // Math.ceil(45.2) = 46
        expect(screen.getByText(/~46s/i)).toBeInTheDocument();
      });
    });

    describe('Stage-Specific Rendering', () => {
      it('should only show buffering UI during CAPTURING stage', () => {
        const { rerender } = render(
          <ProcessingScreen
            processingStatus={{
              stage: 'CAPTURING',
              stageNumber: 1,
              totalStages: 4,
              progress: 25,
              message: 'Capturing...',
              bufferingStatus: createBufferingStatus(),
            }}
            onComplete={mockOnComplete}
            onError={mockOnError}
          />
        );

        // Should show buffering UI in CAPTURING
        expect(screen.getByText(/Frame 25\/50/i)).toBeInTheDocument();

        // Test all other stages - buffering UI should not be visible
        const stages = [
          { stage: 'ANALYZING', stageNumber: 2 },
          { stage: 'ENCODING', stageNumber: 3 },
          { stage: 'FINALIZING', stageNumber: 4 },
        ];

        stages.forEach(({ stage, stageNumber }) => {
          rerender(
            <ProcessingScreen
              processingStatus={{
                stage,
                stageNumber,
                totalStages: 4,
                progress: 25 * stageNumber,
                message: `${stage}...`,
                bufferingStatus: createBufferingStatus(), // Still providing data
              }}
              onComplete={mockOnComplete}
              onError={mockOnError}
            />
          );

          // Buffering UI should not render
          expect(screen.queryByText(/Frame 25\/50/i)).not.toBeInTheDocument();
        });
      });

      it('should not show buffering UI in ERROR or COMPLETED states', () => {
        const { rerender } = render(
          <ProcessingScreen
            processingStatus={{
              stage: 'CAPTURING',
              stageNumber: 1,
              totalStages: 4,
              progress: 25,
              message: 'Capturing...',
              bufferingStatus: createBufferingStatus(),
            }}
            onComplete={mockOnComplete}
            onError={mockOnError}
          />
        );

        expect(screen.getByText(/Frame 25\/50/i)).toBeInTheDocument();

        // Test ERROR state
        rerender(
          <ProcessingScreen
            processingStatus={{
              stage: 'ERROR',
              stageNumber: 2,
              totalStages: 4,
              progress: 0,
              message: 'Error occurred',
              bufferingStatus: createBufferingStatus(),
            }}
            onComplete={mockOnComplete}
            onError={mockOnError}
          />
        );

        expect(screen.queryByText(/Frame 25\/50/i)).not.toBeInTheDocument();

        // Test COMPLETED state
        rerender(
          <ProcessingScreen
            processingStatus={{
              stage: 'COMPLETED',
              stageNumber: 4,
              totalStages: 4,
              progress: 100,
              message: 'Complete!',
              bufferingStatus: createBufferingStatus(),
            }}
            onComplete={mockOnComplete}
            onError={mockOnError}
          />
        );

        expect(screen.queryByText(/Frame 25\/50/i)).not.toBeInTheDocument();
      });
    });
  });
});
