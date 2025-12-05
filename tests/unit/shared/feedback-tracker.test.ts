import { feedbackTracker } from '../../../src/shared/feedback-tracker';

// Mock chrome.storage.local
const mockStorage: Record<string, any> = {};
const mockChromeStorage = {
  local: {
    get: jest.fn((key: string) => {
      return Promise.resolve({ [key]: mockStorage[key] });
    }),
    set: jest.fn((data: Record<string, any>) => {
      Object.assign(mockStorage, data);
      return Promise.resolve();
    }),
  },
};

(global as any).chrome = {
  storage: mockChromeStorage,
};

describe('feedbackTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear mock storage
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    // Clear feedbackTracker cache
    feedbackTracker.clearCache();
  });

  describe('shouldShowPostSuccessFeedback', () => {
    it('should return false when permanentlyDismissed is true', async () => {
      mockStorage['feedback-data'] = {
        firstGifCreatedAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
        lastFeedbackPromptAt: null,
        feedbackCompletedAt: null,
        surveyLinkClickedAt: null,
        permanentlyDismissed: true,
        milestoneFeedbackShown: {
          milestone10: false,
          milestone25: false,
          milestone50: false,
        },
        postSuccessFeedbackLastShown: null,
        postSuccessFeedbackCount: 0,
      };

      const result = await feedbackTracker.shouldShowPostSuccessFeedback();
      expect(result).toBe(false);
    });

    it('should return false when feedbackCompletedAt is set', async () => {
      mockStorage['feedback-data'] = {
        firstGifCreatedAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
        lastFeedbackPromptAt: null,
        feedbackCompletedAt: Date.now(),
        surveyLinkClickedAt: null,
        permanentlyDismissed: false,
        milestoneFeedbackShown: {
          milestone10: false,
          milestone25: false,
          milestone50: false,
        },
        postSuccessFeedbackLastShown: null,
        postSuccessFeedbackCount: 0,
      };

      const result = await feedbackTracker.shouldShowPostSuccessFeedback();
      expect(result).toBe(false);
    });

    it('should return false when max prompts reached', async () => {
      mockStorage['feedback-data'] = {
        firstGifCreatedAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
        lastFeedbackPromptAt: null,
        feedbackCompletedAt: null,
        surveyLinkClickedAt: null,
        permanentlyDismissed: false,
        milestoneFeedbackShown: {
          milestone10: false,
          milestone25: false,
          milestone50: false,
        },
        postSuccessFeedbackLastShown: null,
        postSuccessFeedbackCount: 3, // MAX_POST_SUCCESS_PROMPTS
      };

      const result = await feedbackTracker.shouldShowPostSuccessFeedback();
      expect(result).toBe(false);
    });
  });

  describe('shouldShowTimeFeedback', () => {
    it('should return false when permanentlyDismissed is true', async () => {
      mockStorage['feedback-data'] = {
        firstGifCreatedAt: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
        lastFeedbackPromptAt: null,
        feedbackCompletedAt: null,
        surveyLinkClickedAt: null,
        permanentlyDismissed: true,
        milestoneFeedbackShown: {
          milestone10: false,
          milestone25: false,
          milestone50: false,
        },
        postSuccessFeedbackLastShown: null,
        postSuccessFeedbackCount: 0,
      };

      const result = await feedbackTracker.shouldShowTimeFeedback();
      expect(result).toBe(false);
    });

    it('should return true when eligible and not permanently dismissed', async () => {
      mockStorage['feedback-data'] = {
        firstGifCreatedAt: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago (> 14 days)
        lastFeedbackPromptAt: null,
        feedbackCompletedAt: null,
        surveyLinkClickedAt: null,
        permanentlyDismissed: false,
        milestoneFeedbackShown: {
          milestone10: false,
          milestone25: false,
          milestone50: false,
        },
        postSuccessFeedbackLastShown: null,
        postSuccessFeedbackCount: 0,
      };

      const result = await feedbackTracker.shouldShowTimeFeedback();
      expect(result).toBe(true);
    });
  });

  describe('shouldShowMilestoneFeedback', () => {
    it('should return false when permanentlyDismissed is true', async () => {
      mockStorage['feedback-data'] = {
        firstGifCreatedAt: Date.now(),
        lastFeedbackPromptAt: null,
        feedbackCompletedAt: null,
        surveyLinkClickedAt: null,
        permanentlyDismissed: true,
        milestoneFeedbackShown: {
          milestone10: false,
          milestone25: false,
          milestone50: false,
        },
        postSuccessFeedbackLastShown: null,
        postSuccessFeedbackCount: 0,
      };

      const result = await feedbackTracker.shouldShowMilestoneFeedback(10);
      expect(result).toBe(false);
    });

    it('should return true when eligible and not permanently dismissed', async () => {
      mockStorage['feedback-data'] = {
        firstGifCreatedAt: Date.now(),
        lastFeedbackPromptAt: null,
        feedbackCompletedAt: null,
        surveyLinkClickedAt: null,
        permanentlyDismissed: false,
        milestoneFeedbackShown: {
          milestone10: false,
          milestone25: false,
          milestone50: false,
        },
        postSuccessFeedbackLastShown: null,
        postSuccessFeedbackCount: 0,
      };

      const result = await feedbackTracker.shouldShowMilestoneFeedback(10);
      expect(result).toBe(true);
    });
  });

  describe('recordPermanentDismiss', () => {
    it('should set permanentlyDismissed to true', async () => {
      mockStorage['feedback-data'] = {
        firstGifCreatedAt: Date.now(),
        lastFeedbackPromptAt: null,
        feedbackCompletedAt: null,
        surveyLinkClickedAt: null,
        permanentlyDismissed: false,
        milestoneFeedbackShown: {
          milestone10: false,
          milestone25: false,
          milestone50: false,
        },
        postSuccessFeedbackLastShown: null,
        postSuccessFeedbackCount: 0,
      };

      await feedbackTracker.recordPermanentDismiss();

      expect(mockChromeStorage.local.set).toHaveBeenCalled();
      const setCall = mockChromeStorage.local.set.mock.calls[0][0];
      expect(setCall['feedback-data'].permanentlyDismissed).toBe(true);
    });

    it('should prevent future feedback prompts after permanent dismiss', async () => {
      mockStorage['feedback-data'] = {
        firstGifCreatedAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
        lastFeedbackPromptAt: null,
        feedbackCompletedAt: null,
        surveyLinkClickedAt: null,
        permanentlyDismissed: false,
        milestoneFeedbackShown: {
          milestone10: false,
          milestone25: false,
          milestone50: false,
        },
        postSuccessFeedbackLastShown: null,
        postSuccessFeedbackCount: 0,
      };

      // Should be eligible before dismiss
      const beforeTimeFeedback = await feedbackTracker.shouldShowTimeFeedback();
      expect(beforeTimeFeedback).toBe(true);

      // Clear cache to force re-read
      feedbackTracker.clearCache();

      // Permanently dismiss
      await feedbackTracker.recordPermanentDismiss();

      // Clear cache to force re-read
      feedbackTracker.clearCache();

      // Should not be eligible after dismiss
      const afterTimeFeedback = await feedbackTracker.shouldShowTimeFeedback();
      expect(afterTimeFeedback).toBe(false);

      const afterMilestoneFeedback = await feedbackTracker.shouldShowMilestoneFeedback(10);
      expect(afterMilestoneFeedback).toBe(false);
    });
  });
});
