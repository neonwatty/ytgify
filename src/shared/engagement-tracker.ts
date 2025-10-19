import { EngagementData } from '@/types/storage';

const STORAGE_KEY = 'engagement-data';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

class EngagementTracker {
  private cache: EngagementData | null = null;
  private cacheTimestamp = 0;
  private initialized = false;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
  }

  private isCacheValid(): boolean {
    return this.cache !== null && (Date.now() - this.cacheTimestamp) < CACHE_TTL;
  }

  private async getStorageData(): Promise<EngagementData> {
    if (this.isCacheValid()) {
      return this.cache!;
    }

    const result = await chrome.storage.local.get(STORAGE_KEY);
    const data = result[STORAGE_KEY] as EngagementData | undefined;

    if (!data) {
      // Return default data if not initialized
      return this.getDefaultData();
    }

    this.cache = data;
    this.cacheTimestamp = Date.now();
    return data;
  }

  private async setStorageData(data: EngagementData): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEY]: data });
    this.cache = data;
    this.cacheTimestamp = Date.now();
  }

  private getDefaultData(): EngagementData {
    return {
      installDate: Date.now(),
      totalGifsCreated: 0,
      prompts: {
        primary: {
          shown: false
        }
      },
      milestones: {
        milestone10: false,
        milestone25: false,
        milestone50: false
      },
      popupFooterDismissed: false
    };
  }

  async initializeEngagement(): Promise<void> {
    const data = await this.getStorageData();

    // Only initialize if data doesn't exist (first install)
    if (data.installDate === this.getDefaultData().installDate) {
      const defaultData = this.getDefaultData();
      await this.setStorageData(defaultData);
    }
  }

  async incrementGifCount(): Promise<number> {
    const data = await this.getStorageData();
    data.totalGifsCreated += 1;
    await this.setStorageData(data);
    return data.totalGifsCreated;
  }

  async shouldShowPrompt(): Promise<boolean> {
    const data = await this.getStorageData();
    // Primary: 5+ GIFs, not shown before
    return (
      data.totalGifsCreated >= 5 &&
      !data.prompts.primary.shown
    );
  }

  async shouldShowMilestone(count: 10 | 25 | 50): Promise<boolean> {
    const data = await this.getStorageData();

    // Check if we're at the exact count
    if (data.totalGifsCreated !== count) {
      return false;
    }

    // Check if milestone already shown
    const milestoneKey = `milestone${count}` as keyof typeof data.milestones;
    return !data.milestones[milestoneKey];
  }

  async recordPromptShown(): Promise<void> {
    const data = await this.getStorageData();
    data.prompts.primary.shown = true;
    await this.setStorageData(data);
  }

  async recordMilestoneShown(count: 10 | 25 | 50): Promise<void> {
    const data = await this.getStorageData();
    const milestoneKey = `milestone${count}` as keyof typeof data.milestones;
    data.milestones[milestoneKey] = true;
    await this.setStorageData(data);
  }

  async recordDismissal(type: 'primary' | 'popup-footer'): Promise<void> {
    const data = await this.getStorageData();

    if (type === 'popup-footer') {
      data.popupFooterDismissed = true;
    } else {
      data.prompts.primary.dismissedAt = Date.now();
    }

    await this.setStorageData(data);
  }

  async recordAction(action: 'rate' | 'share' | 'github'): Promise<void> {
    const data = await this.getStorageData();
    data.prompts.primary.clickedAction = action;
    await this.setStorageData(data);
  }

  async getEngagementStats(): Promise<EngagementData> {
    return this.getStorageData();
  }

  clearCache(): void {
    this.cache = null;
    this.cacheTimestamp = 0;
  }

  async reset(): Promise<void> {
    const defaultData = this.getDefaultData();
    await this.setStorageData(defaultData);
  }
}

// Singleton instance
export const engagementTracker = new EngagementTracker();
