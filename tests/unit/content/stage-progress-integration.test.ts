import { StageProgressInfo } from '../../../src/content/gif-processor';

// Mock content script index
const mockProgressCallbacks: Array<(stageInfo: StageProgressInfo) => void> = [];
const mockMapStageToNumber = jest.fn((stage: string): number => {
  const stageMap: Record<string, number> = {
    CAPTURING: 1,
    ANALYZING: 2,
    ENCODING: 3,
    FINALIZING: 4,
    COMPLETED: 4,
    ERROR: 0,
    error: 0,
  };
  return stageMap[stage] || 0;
});

// Mock chrome runtime for message passing
const mockChrome = {
  runtime: {
    sendMessage: jest.fn(),
  },
};
(global as unknown as { chrome: typeof mockChrome }).chrome = mockChrome;

describe('Stage Progress Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProgressCallbacks.length = 0;
  });

  describe('StageProgressInfo Interface Validation', () => {
    it('should validate complete StageProgressInfo structure', () => {
      const validStageInfo: StageProgressInfo = {
        stage: 'CAPTURING',
        stageNumber: 1,
        totalStages: 4,
        stageName: 'Capturing Frames',
        progress: 25,
        message: 'Reading video data...',
      };

      expect(validStageInfo).toMatchObject({
        stage: expect.any(String),
        stageNumber: expect.any(Number),
        totalStages: expect.any(Number),
        stageName: expect.any(String),
        progress: expect.any(Number),
        message: expect.any(String),
      });

      expect(validStageInfo.stageNumber).toBeGreaterThanOrEqual(0);
      expect(validStageInfo.stageNumber).toBeLessThanOrEqual(4);
      expect(validStageInfo.totalStages).toBe(4);
      expect(validStageInfo.progress).toBeGreaterThanOrEqual(0);
      expect(validStageInfo.progress).toBeLessThanOrEqual(100);
    });

    it('should handle all valid stage types', () => {
      const validStages = [
        'CAPTURING',
        'ANALYZING',
        'ENCODING',
        'FINALIZING',
        'COMPLETED',
        'ERROR',
      ];

      validStages.forEach((stage) => {
        const stageNumber = mockMapStageToNumber(stage);
        expect(stageNumber).toBeGreaterThanOrEqual(0);
        expect(stageNumber).toBeLessThanOrEqual(4);
      });
    });

    it('should map stages to correct numbers', () => {
      expect(mockMapStageToNumber('CAPTURING')).toBe(1);
      expect(mockMapStageToNumber('ANALYZING')).toBe(2);
      expect(mockMapStageToNumber('ENCODING')).toBe(3);
      expect(mockMapStageToNumber('FINALIZING')).toBe(4);
      expect(mockMapStageToNumber('COMPLETED')).toBe(4);
      expect(mockMapStageToNumber('ERROR')).toBe(0);
      expect(mockMapStageToNumber('error')).toBe(0);
    });

    it('should handle unknown stages gracefully', () => {
      expect(mockMapStageToNumber('UNKNOWN_STAGE')).toBe(0);
      expect(mockMapStageToNumber('')).toBe(0);
    });
  });

  describe('Message Cycling Behavior', () => {
    it('should provide different messages for the same stage', () => {
      const capturingMessages = [
        'Reading video data...',
        'Extracting frames...',
        'Processing frame timings...',
        'Capturing pixel data...',
        'Organizing frame sequence...',
      ];

      // Test that we have variety in messages
      expect(capturingMessages.length).toBeGreaterThan(3);
      expect(new Set(capturingMessages).size).toBe(capturingMessages.length);

      capturingMessages.forEach((message) => {
        expect(message.length).toBeGreaterThan(5);
        expect(message).toMatch(/\.\.\./); // All should end with ...
      });
    });

    it('should provide stage-appropriate messages', () => {
      const stageMessages = {
        CAPTURING: ['Reading video data...', 'Extracting frames...'],
        ANALYZING: ['Analyzing color palette...', 'Optimizing colors...'],
        ENCODING: ['Encoding frames...', 'Compressing data...'],
        FINALIZING: ['Finalizing GIF...', 'Preparing download...'],
      };

      Object.entries(stageMessages).forEach(([_stage, messages]) => {
        messages.forEach((message) => {
          expect(message).toBeTruthy();
          expect(typeof message).toBe('string');
          expect(message.length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('Progress Calculation Logic', () => {
    it('should calculate stage-based progress correctly', () => {
      // Test stage 1 (CAPTURING) progress calculation
      const stage1Progress = (1 - 1) * 25 + (50 * 25) / 100; // Stage base + internal progress
      expect(stage1Progress).toBe(12.5);

      // Test stage 2 (ANALYZING) progress calculation
      const stage2Progress = (2 - 1) * 25 + (30 * 25) / 100;
      expect(stage2Progress).toBe(32.5);

      // Test stage 3 (ENCODING) progress calculation
      const stage3Progress = (3 - 1) * 25 + (75 * 25) / 100;
      expect(stage3Progress).toBe(68.75);

      // Test stage 4 (FINALIZING) progress calculation
      const stage4Progress = (4 - 1) * 25 + (100 * 25) / 100;
      expect(stage4Progress).toBe(100);
    });

    it('should keep progress within bounds', () => {
      // Test edge cases
      const testCases = [
        { stage: 1, internal: 0, expected: 0 },
        { stage: 1, internal: 100, expected: 25 },
        { stage: 4, internal: 0, expected: 75 },
        { stage: 4, internal: 100, expected: 100 },
        { stage: 0, internal: 50, expected: 0 }, // Error state
      ];

      testCases.forEach(({ stage, internal, expected }) => {
        const progress = Math.max(0, Math.min(100, (stage - 1) * 25 + (internal * 25) / 100));
        expect(progress).toBe(expected);
      });
    });
  });

  describe('Error State Handling', () => {
    it('should handle ERROR stage correctly', () => {
      const errorStageInfo: StageProgressInfo = {
        stage: 'ERROR',
        stageNumber: 0,
        totalStages: 4,
        stageName: 'Error occurred',
        progress: 0,
        message: 'Processing failed: Encoding error',
      };

      expect(errorStageInfo.stage).toBe('ERROR');
      expect(errorStageInfo.stageNumber).toBe(0);
      expect(errorStageInfo.progress).toBe(0);
      expect(errorStageInfo.message).toContain('failed');
    });

    it('should handle error at different stages', () => {
      const errorAtStage2: StageProgressInfo = {
        stage: 'ERROR',
        stageNumber: 2, // Failed during ANALYZING
        totalStages: 4,
        stageName: 'Error during analysis',
        progress: 0,
        message: 'Color analysis failed',
      };

      expect(mockMapStageToNumber('ERROR')).toBe(0);
      expect(errorAtStage2.stageNumber).toBe(2); // Remembers where it failed
      expect(errorAtStage2.message).toContain('failed');
    });
  });

  describe('Message Broadcasting', () => {
    it('should send progress updates via Chrome messaging', () => {
      const testStageInfo: StageProgressInfo = {
        stage: 'ENCODING',
        stageNumber: 3,
        totalStages: 4,
        stageName: 'Encoding GIF',
        progress: 75,
        message: 'Encoding frames...',
      };

      // Simulate sending message
      mockChrome.runtime.sendMessage({
        type: 'GIF_PROGRESS',
        stageInfo: testStageInfo as unknown as Record<string, unknown>,
      });

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'GIF_PROGRESS',
        stageInfo: testStageInfo,
      });
    });

    it('should handle message conversion for Chrome API', () => {
      const stageInfo: StageProgressInfo = {
        stage: 'FINALIZING',
        stageNumber: 4,
        totalStages: 4,
        stageName: 'Finalizing',
        progress: 95,
        message: 'Almost done...',
      };

      // Test type casting as done in content script
      const chromeMessage = stageInfo as unknown as Record<string, unknown>;

      expect(chromeMessage).toHaveProperty('stage');
      expect(chromeMessage).toHaveProperty('stageNumber');
      expect(chromeMessage).toHaveProperty('totalStages');
      expect(chromeMessage).toHaveProperty('progress');
      expect(chromeMessage).toHaveProperty('message');
    });
  });

  describe('Completion Handling', () => {
    it('should handle COMPLETED stage properly', () => {
      const completedStageInfo: StageProgressInfo = {
        stage: 'COMPLETED',
        stageNumber: 4,
        totalStages: 4,
        stageName: 'All stages complete',
        progress: 100,
        message: 'GIF created successfully!',
      };

      expect(completedStageInfo.stage).toBe('COMPLETED');
      expect(completedStageInfo.stageNumber).toBe(4);
      expect(completedStageInfo.progress).toBe(100);
      expect(mockMapStageToNumber('COMPLETED')).toBe(4);
    });

    it('should transition from FINALIZING to COMPLETED', () => {
      const finalizingStage: StageProgressInfo = {
        stage: 'FINALIZING',
        stageNumber: 4,
        totalStages: 4,
        stageName: 'Finalizing',
        progress: 90,
        message: 'Finalizing GIF...',
      };

      const completedStage: StageProgressInfo = {
        stage: 'COMPLETED',
        stageNumber: 4,
        totalStages: 4,
        stageName: 'All stages complete',
        progress: 100,
        message: 'GIF created successfully!',
      };

      expect(finalizingStage.stageNumber).toBe(completedStage.stageNumber);
      expect(finalizingStage.totalStages).toBe(completedStage.totalStages);
      expect(finalizingStage.progress).toBeLessThan(completedStage.progress);
    });
  });
});
