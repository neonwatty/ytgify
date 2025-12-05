import { FeedbackData } from '@/types/storage';

const FEEDBACK_STORAGE_KEY = 'feedback-data';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Rate limiting constants
const POST_SUCCESS_MIN_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 days
const TIME_BASED_TRIGGER_DAYS = 14;
const TIME_BASED_COOLDOWN_DAYS = 7;
const POST_SUCCESS_RATE = 0.15; // 15% chance
const MAX_POST_SUCCESS_PROMPTS = 3;

class FeedbackTracker {
  private cache: FeedbackData | null = null;
  private cacheTimestamp = 0;

  private isCacheValid(): boolean {
    return this.cache !== null && Date.now() - this.cacheTimestamp < CACHE_TTL;
  }

  private async getStorageData(): Promise<FeedbackData> {
    if (this.isCacheValid()) {
      return this.cache!;
    }

    const result = await chrome.storage.local.get(FEEDBACK_STORAGE_KEY);
    const data = result[FEEDBACK_STORAGE_KEY] as FeedbackData | undefined;

    if (!data) {
      return this.getDefaultData();
    }

    this.cache = data;
    this.cacheTimestamp = Date.now();
    return data;
  }

  private async setStorageData(data: FeedbackData): Promise<void> {
    await chrome.storage.local.set({ [FEEDBACK_STORAGE_KEY]: data });
    this.cache = data;
    this.cacheTimestamp = Date.now();
  }

  private getDefaultData(): FeedbackData {
    return {
      firstGifCreatedAt: null,
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
  }

  /**
   * Check if milestone-based feedback should be shown
   */
  async shouldShowMilestoneFeedback(count: 10 | 25 | 50): Promise<boolean> {
    const data = await this.getStorageData();

    // Don't show if permanently dismissed
    if (data.permanentlyDismissed) return false;

    // Don't show if already completed feedback
    if (data.feedbackCompletedAt) return false;

    const key = `milestone${count}` as keyof typeof data.milestoneFeedbackShown;
    return !data.milestoneFeedbackShown[key];
  }

  /**
   * Check if time-based feedback should be shown (14+ days since first GIF)
   */
  async shouldShowTimeFeedback(): Promise<boolean> {
    const data = await this.getStorageData();

    // Don't show if permanently dismissed
    if (data.permanentlyDismissed) return false;

    // Don't show if already completed feedback
    if (data.feedbackCompletedAt) return false;

    // Need first GIF timestamp
    if (!data.firstGifCreatedAt) return false;

    const daysSinceFirst =
      (Date.now() - data.firstGifCreatedAt) / (24 * 60 * 60 * 1000);
    if (daysSinceFirst < TIME_BASED_TRIGGER_DAYS) return false;

    // Check cooldown from last prompt
    if (data.lastFeedbackPromptAt) {
      const daysSincePrompt =
        (Date.now() - data.lastFeedbackPromptAt) / (24 * 60 * 60 * 1000);
      if (daysSincePrompt < TIME_BASED_COOLDOWN_DAYS) return false;
    }

    return true;
  }

  /**
   * Check if post-success feedback should be shown (15% chance with rate limiting)
   */
  async shouldShowPostSuccessFeedback(): Promise<boolean> {
    const data = await this.getStorageData();

    // Don't show if permanently dismissed
    if (data.permanentlyDismissed) return false;

    // Don't show if already completed feedback
    if (data.feedbackCompletedAt) return false;

    // Check max prompts
    if (data.postSuccessFeedbackCount >= MAX_POST_SUCCESS_PROMPTS) return false;

    // Check cooldown
    if (data.postSuccessFeedbackLastShown) {
      if (Date.now() - data.postSuccessFeedbackLastShown < POST_SUCCESS_MIN_INTERVAL) {
        return false;
      }
    }

    // Random chance
    return Math.random() < POST_SUCCESS_RATE;
  }

  /**
   * Record that feedback prompt was shown
   */
  async recordFeedbackShown(
    trigger: 'milestone' | 'time' | 'post-success',
    milestoneCount?: 10 | 25 | 50
  ): Promise<void> {
    const data = await this.getStorageData();
    data.lastFeedbackPromptAt = Date.now();

    if (trigger === 'milestone' && milestoneCount) {
      const key = `milestone${milestoneCount}` as keyof typeof data.milestoneFeedbackShown;
      data.milestoneFeedbackShown[key] = true;
    }

    if (trigger === 'post-success') {
      data.postSuccessFeedbackLastShown = Date.now();
      data.postSuccessFeedbackCount++;
    }

    await this.setStorageData(data);
  }

  /**
   * Record that user permanently dismissed feedback prompts
   */
  async recordPermanentDismiss(): Promise<void> {
    const data = await this.getStorageData();
    data.permanentlyDismissed = true;
    await this.setStorageData(data);
  }

  /**
   * Record that user clicked survey link
   */
  async recordSurveyClicked(): Promise<void> {
    const data = await this.getStorageData();
    data.surveyLinkClickedAt = Date.now();
    await this.setStorageData(data);
  }

  /**
   * Record first GIF created timestamp (call from engagement tracker)
   */
  async recordFirstGifCreated(): Promise<void> {
    const data = await this.getStorageData();
    if (!data.firstGifCreatedAt) {
      data.firstGifCreatedAt = Date.now();
      await this.setStorageData(data);
    }
  }

  /**
   * Get feedback stats for debugging
   */
  async getFeedbackStats(): Promise<FeedbackData> {
    return this.getStorageData();
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Reset all feedback data
   */
  async reset(): Promise<void> {
    const defaultData = this.getDefaultData();
    await this.setStorageData(defaultData);
  }
}

// Singleton instance
export const feedbackTracker = new FeedbackTracker();
