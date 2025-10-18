import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock chrome storage
const mockStorage = {
  local: {
    get: jest.fn(),
    set: jest.fn(),
  },
};

global.chrome = {
  storage: mockStorage,
  runtime: {
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    sendMessage: jest.fn(),
  },
} as any;

import { engagementTracker } from '@/shared/engagement-tracker';
import type { EngagementData } from '@/types/storage';

describe('EngagementTracker', () => {
  const STORAGE_KEY = 'engagement-data';
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  const QUALIFICATION_THRESHOLD = {
    PRIMARY_MIN_GIFS: 5,
    SECONDARY_MIN_GIFS: 10,
  };

  let mockEngagementData: EngagementData;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock engagement data
    mockEngagementData = {
      installDate: Date.now() - (15 * 24 * 60 * 60 * 1000), // 15 days ago
      totalGifsCreated: 0,
      prompts: {
        primary: { shown: false },
      },
      milestones: {
        milestone10: false,
        milestone25: false,
        milestone50: false,
      },
      popupFooterDismissed: false,
    };

    // Default mock implementation
    (mockStorage.local.get as jest.Mock).mockImplementation((...args: any[]) => {
      const callback = args[1];
      if (typeof callback === 'function') {
        callback({ [STORAGE_KEY]: mockEngagementData });
      }
      return Promise.resolve({ [STORAGE_KEY]: mockEngagementData });
    });

    (mockStorage.local.set as jest.Mock).mockImplementation((...args: any[]) => {
      const callback = args[1];
      if (typeof callback === 'function') {
        callback();
      }
      return Promise.resolve();
    });

    // Clear any cached data
    (engagementTracker as any).cache = null;
    (engagementTracker as any).cacheTimestamp = 0;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize engagement data with default values', async () => {
      (mockStorage.local.get as jest.Mock).mockImplementation((...args: any[]) => {
        const callback = args[1];
        if (callback) callback({});
        return Promise.resolve({});
      });

      await engagementTracker.initializeEngagement();

      expect(mockStorage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          [STORAGE_KEY]: expect.objectContaining({
            installDate: expect.any(Number),
            totalGifsCreated: 0,
            prompts: {
              primary: { shown: false },
            },
            milestones: {
              milestone10: false,
              milestone25: false,
              milestone50: false,
            },
            popupFooterDismissed: false,
          }),
        })
      );
    });

    it('should not overwrite existing engagement data', async () => {
      const existingData: EngagementData = {
        installDate: Date.now() - (30 * 24 * 60 * 60 * 1000),
        totalGifsCreated: 20,
        prompts: {
          primary: { shown: true, dismissedAt: Date.now() },
        },
        milestones: {
          milestone10: true,
          milestone25: false,
          milestone50: false,
        },
        popupFooterDismissed: true,
      };

      (mockStorage.local.get as jest.Mock).mockImplementation((...args: any[]) => {
        const callback = args[1];
        if (callback) callback({ [STORAGE_KEY]: existingData });
        return Promise.resolve({ [STORAGE_KEY]: existingData });
      });

      await engagementTracker.initializeEngagement();

      expect(mockStorage.local.set).not.toHaveBeenCalled();
    });

    it('should handle storage errors gracefully', async () => {
      (mockStorage.local.get as jest.Mock).mockImplementation(() => {
        throw new Error('Storage error');
      });

      await expect(engagementTracker.initializeEngagement()).rejects.toThrow();
    });
  });

  describe('GIF Count Tracking', () => {
    it('should increment GIF count', async () => {
      mockEngagementData.totalGifsCreated = 5;

      const newCount = await engagementTracker.incrementGifCount();

      expect(newCount).toBe(6);
      expect(mockStorage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          [STORAGE_KEY]: expect.objectContaining({
            totalGifsCreated: 6,
          }),
        })
      );
    });

    it('should increment from 0', async () => {
      mockEngagementData.totalGifsCreated = 0;

      const newCount = await engagementTracker.incrementGifCount();

      expect(newCount).toBe(1);
    });

    it('should handle multiple increments', async () => {
      mockEngagementData.totalGifsCreated = 0;

      let count = 0;
      (mockStorage.local.get as jest.Mock).mockImplementation((...args: any[]) => {
        const callback = args[1];
        const data = { ...mockEngagementData, totalGifsCreated: count };
        if (callback) callback({ [STORAGE_KEY]: data });
        return Promise.resolve({ [STORAGE_KEY]: data });
      });

      (mockStorage.local.set as jest.Mock).mockImplementation((...args: any[]) => {
        const data = args[0];
        const callback = args[1];
        count = (data as any)[STORAGE_KEY].totalGifsCreated;
        if (callback) callback();
        return Promise.resolve();
      });

      await engagementTracker.incrementGifCount();
      await engagementTracker.incrementGifCount();
      const finalCount = await engagementTracker.incrementGifCount();

      expect(finalCount).toBe(3);
    });

    it('should handle concurrent increments', async () => {
      mockEngagementData.totalGifsCreated = 10;

      const promises = [
        engagementTracker.incrementGifCount(),
        engagementTracker.incrementGifCount(),
        engagementTracker.incrementGifCount(),
      ];

      await Promise.all(promises);

      // Should have been called 3 times
      expect(mockStorage.local.set).toHaveBeenCalledTimes(3);
    });
  });

  describe('Prompt Qualification', () => {
    it('should return false when GIF count is below threshold', async () => {
      mockEngagementData.totalGifsCreated = 3;
      mockEngagementData.prompts.primary = { shown: false };

      const qualifies = await engagementTracker.shouldShowPrompt();

      expect(qualifies).toBe(false);
    });

    it('should return true when GIF threshold is met', async () => {
      mockEngagementData.totalGifsCreated = 6;
      mockEngagementData.prompts.primary = { shown: false };

      const qualifies = await engagementTracker.shouldShowPrompt();

      expect(qualifies).toBe(true);
    });

    it('should return false if primary prompt already shown', async () => {
      mockEngagementData.totalGifsCreated = 6;
      mockEngagementData.prompts.primary = { shown: true };

      const qualifies = await engagementTracker.shouldShowPrompt();

      expect(qualifies).toBe(false);
    });

    it('should return false if primary prompt was dismissed', async () => {
      mockEngagementData.totalGifsCreated = 6;
      mockEngagementData.prompts.primary = { shown: true, dismissedAt: Date.now() };

      const qualifies = await engagementTracker.shouldShowPrompt();

      expect(qualifies).toBe(false);
    });

    it('should handle exact threshold value (5 GIFs)', async () => {
      mockEngagementData.totalGifsCreated = 5; // Exactly PRIMARY_MIN_GIFS
      mockEngagementData.prompts.primary = { shown: false };

      const qualifies = await engagementTracker.shouldShowPrompt();

      expect(qualifies).toBe(true);
    });

    it('should handle one GIF less than threshold', async () => {
      mockEngagementData.totalGifsCreated = 4; // One less than PRIMARY_MIN_GIFS
      mockEngagementData.prompts.primary = { shown: false };

      const qualifies = await engagementTracker.shouldShowPrompt();

      expect(qualifies).toBe(false);
    });
  });

  describe('Milestone Tracking', () => {
    it('should show milestone at exactly 10 GIFs', async () => {
      mockEngagementData.totalGifsCreated = 10;
      mockEngagementData.milestones.milestone10 = false;

      const shouldShow = await engagementTracker.shouldShowMilestone(10);

      expect(shouldShow).toBe(true);
    });

    it('should not show milestone 10 if already shown', async () => {
      mockEngagementData.totalGifsCreated = 10;
      mockEngagementData.milestones.milestone10 = true;

      const shouldShow = await engagementTracker.shouldShowMilestone(10);

      expect(shouldShow).toBe(false);
    });

    it('should show milestone 25', async () => {
      mockEngagementData.totalGifsCreated = 25;
      mockEngagementData.milestones.milestone25 = false;

      const shouldShow = await engagementTracker.shouldShowMilestone(25);

      expect(shouldShow).toBe(true);
    });

    it('should show milestone 50', async () => {
      mockEngagementData.totalGifsCreated = 50;
      mockEngagementData.milestones.milestone50 = false;

      const shouldShow = await engagementTracker.shouldShowMilestone(50);

      expect(shouldShow).toBe(true);
    });

    it('should record milestone as shown', async () => {
      mockEngagementData.totalGifsCreated = 10;
      mockEngagementData.milestones.milestone10 = false;

      await engagementTracker.recordMilestoneShown(10);

      expect(mockStorage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          [STORAGE_KEY]: expect.objectContaining({
            milestones: expect.objectContaining({
              milestone10: true,
            }),
          }),
        })
      );
    });

    it('should handle all three milestone types', async () => {
      await engagementTracker.recordMilestoneShown(10);
      await engagementTracker.recordMilestoneShown(25);
      await engagementTracker.recordMilestoneShown(50);

      expect(mockStorage.local.set).toHaveBeenCalledTimes(3);
    });

    it('should not show milestone if GIF count is above milestone', async () => {
      mockEngagementData.totalGifsCreated = 15;
      mockEngagementData.milestones.milestone10 = false;

      const shouldShow = await engagementTracker.shouldShowMilestone(10);

      expect(shouldShow).toBe(false);
    });

    it('should not show milestone if GIF count is below milestone', async () => {
      mockEngagementData.totalGifsCreated = 5;
      mockEngagementData.milestones.milestone10 = false;

      const shouldShow = await engagementTracker.shouldShowMilestone(10);

      expect(shouldShow).toBe(false);
    });
  });

  describe('Dismissal Tracking', () => {
    it('should record primary prompt dismissal', async () => {
      await engagementTracker.recordDismissal('primary');

      expect(mockStorage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          [STORAGE_KEY]: expect.objectContaining({
            prompts: expect.objectContaining({
              primary: expect.objectContaining({
                dismissedAt: expect.any(Number),
              }),
            }),
          }),
        })
      );
    });


    it('should record popup footer dismissal', async () => {
      await engagementTracker.recordDismissal('popup-footer');

      expect(mockStorage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          [STORAGE_KEY]: expect.objectContaining({
            popupFooterDismissed: true,
          }),
        })
      );
    });

    it('should set dismissedAt timestamp when dismissed', async () => {
      mockEngagementData.prompts.primary = { shown: false };

      await engagementTracker.recordDismissal('primary');

      const data = ((mockStorage.local.set as jest.Mock).mock.calls[0][0] as any)[STORAGE_KEY];
      expect(data.prompts.primary.dismissedAt).toBeDefined();
    });
  });

  describe('Action Tracking', () => {
    it('should record rate action', async () => {
      await engagementTracker.recordAction('rate');

      expect(mockStorage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          [STORAGE_KEY]: expect.objectContaining({
            prompts: expect.objectContaining({
              primary: expect.objectContaining({
                clickedAction: 'rate',
              }),
            }),
          }),
        })
      );
    });

    it('should record share action', async () => {
      await engagementTracker.recordAction('share');

      const data = ((mockStorage.local.set as jest.Mock).mock.calls[0][0] as any)[STORAGE_KEY];
      expect(data.prompts.primary.clickedAction).toBe('share');
    });

    it('should record github action', async () => {
      await engagementTracker.recordAction('github');

      const data = ((mockStorage.local.set as jest.Mock).mock.calls[0][0] as any)[STORAGE_KEY];
      expect(data.prompts.primary.clickedAction).toBe('github');
    });

    it('should set clickedAction when action is recorded', async () => {
      mockEngagementData.prompts.primary = { shown: false };

      await engagementTracker.recordAction('rate');

      const data = ((mockStorage.local.set as jest.Mock).mock.calls[0][0] as any)[STORAGE_KEY];
      expect(data.prompts.primary.clickedAction).toBe('rate');
    });
  });

  describe('Stats Retrieval', () => {
    it('should return current engagement stats', async () => {
      const stats = await engagementTracker.getEngagementStats();

      expect(stats).toEqual(mockEngagementData);
    });

    it('should calculate days since install', async () => {
      const fifteenDaysAgo = Date.now() - (15 * 24 * 60 * 60 * 1000);
      mockEngagementData.installDate = fifteenDaysAgo;

      const stats = await engagementTracker.getEngagementStats();

      const daysSinceInstall = Math.floor((Date.now() - stats.installDate) / (24 * 60 * 60 * 1000));
      expect(daysSinceInstall).toBeGreaterThanOrEqual(14);
      expect(daysSinceInstall).toBeLessThanOrEqual(15);
    });

    it('should return fresh data from storage', async () => {
      const firstStats = await engagementTracker.getEngagementStats();

      mockEngagementData.totalGifsCreated = 25;

      // Clear cache to force fresh fetch
      (engagementTracker as any).cache = null;
      (engagementTracker as any).cacheTimestamp = 0;

      const secondStats = await engagementTracker.getEngagementStats();

      expect(secondStats.totalGifsCreated).toBe(25);
    });
  });

  describe('Caching Behavior', () => {
    it('should cache engagement data', async () => {
      await engagementTracker.getEngagementStats();
      await engagementTracker.getEngagementStats();

      // Should only call storage once due to caching
      expect(mockStorage.local.get).toHaveBeenCalledTimes(1);
    });

    it('should refresh cache after expiration', async () => {
      await engagementTracker.getEngagementStats();

      // Manually expire cache
      (engagementTracker as any).cacheTimestamp = Date.now() - (CACHE_DURATION + 1000);

      await engagementTracker.getEngagementStats();

      // Should call storage twice
      expect(mockStorage.local.get).toHaveBeenCalledTimes(2);
    });

    it('should use cache for write operations', async () => {
      await engagementTracker.getEngagementStats();
      expect(mockStorage.local.get).toHaveBeenCalledTimes(1);

      // incrementGifCount uses cached data
      await engagementTracker.incrementGifCount();

      // Subsequent reads also use cache
      await engagementTracker.getEngagementStats();

      // Only one storage read - cache is reused throughout
      expect(mockStorage.local.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing engagement data in storage', async () => {
      (mockStorage.local.get as jest.Mock).mockImplementation((...args: any[]) => {
        const callback = args[1];
        if (callback) callback({});
        return Promise.resolve({});
      });

      const stats = await engagementTracker.getEngagementStats();

      expect(stats).toEqual({
        installDate: expect.any(Number),
        totalGifsCreated: 0,
        prompts: {
          primary: { shown: false },
        },
        milestones: {
          milestone10: false,
          milestone25: false,
          milestone50: false,
        },
        popupFooterDismissed: false,
      });
    });

    it('should handle corrupted data gracefully', async () => {
      (mockStorage.local.get as jest.Mock).mockImplementation((...args: any[]) => {
        const callback = args[1];
        if (callback) callback({ [STORAGE_KEY]: null });
        return Promise.resolve({ [STORAGE_KEY]: null });
      });

      const stats = await engagementTracker.getEngagementStats();

      expect(stats.totalGifsCreated).toBeDefined();
      expect(stats.installDate).toBeDefined();
    });

    it('should handle very large GIF counts', async () => {
      mockEngagementData.totalGifsCreated = 999999;

      const newCount = await engagementTracker.incrementGifCount();

      expect(newCount).toBe(1000000);
    });

    it('should handle future install date (clock skew)', async () => {
      mockEngagementData.installDate = Date.now() + (1000 * 60 * 60); // 1 hour in future
      mockEngagementData.totalGifsCreated = 3;

      const qualifies = await engagementTracker.shouldShowPrompt();

      expect(qualifies).toBe(false);
    });

    it('should handle install date of 0', async () => {
      mockEngagementData.installDate = 0;
      mockEngagementData.totalGifsCreated = 6;
      mockEngagementData.prompts.primary = { shown: false };

      const qualifies = await engagementTracker.shouldShowPrompt();

      // Should qualify because GIF count is >= 5
      expect(qualifies).toBe(true);
    });
  });
});
