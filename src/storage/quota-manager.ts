import { StorageQuota, StorageEventListener } from '@/types/storage';
import { gifDatabase } from './database';

export interface QuotaStatus {
  used: number;
  total: number;
  available: number;
  percentage: number;
  status: 'healthy' | 'warning' | 'critical';
}

export interface CleanupPolicy {
  enabled: boolean;
  thresholdPercentage: number;
  targetPercentage: number;
  olderThanDays: number;
  requireUserConsent: boolean;
}

export interface CleanupSuggestion {
  type: 'old-gifs' | 'large-gifs' | 'unused-gifs';
  count: number;
  estimatedSavings: number;
  description: string;
  action: () => Promise<number>;
}

export class QuotaManager {
  private listeners: Set<StorageEventListener> = new Set();
  private lastQuotaCheck: StorageQuota | null = null;
  private checkInterval: number | null = null;
  private cleanupPolicy: CleanupPolicy = {
    enabled: false,
    thresholdPercentage: 80,
    targetPercentage: 60,
    olderThanDays: 30,
    requireUserConsent: true
  };

  private readonly WARNING_THRESHOLD = 80;
  private readonly CRITICAL_THRESHOLD = 90;

  async getQuotaStatus(): Promise<QuotaStatus> {
    try {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage || 0;
      const total = estimate.quota || Number.MAX_SAFE_INTEGER;
      const available = total - used;
      const percentage = (used / total) * 100;
      
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (percentage >= this.CRITICAL_THRESHOLD) {
        status = 'critical';
      } else if (percentage >= this.WARNING_THRESHOLD) {
        status = 'warning';
      }

      const quotaStatus = {
        used,
        total,
        available,
        percentage,
        status
      };

      this.checkForQuotaChanges(quotaStatus);

      return quotaStatus;
    } catch (error) {
      console.error('Failed to get storage quota:', error);
      return {
        used: 0,
        total: Number.MAX_SAFE_INTEGER,
        available: Number.MAX_SAFE_INTEGER,
        percentage: 0,
        status: 'healthy'
      };
    }
  }

  async getDetailedUsage(): Promise<{
    totalGifs: number;
    totalSize: number;
    averageSize: number;
    largestGif: { id: string; size: number } | null;
    oldestGif: { id: string; age: number } | null;
    sizeDistribution: { range: string; count: number }[];
  }> {
    const gifs = await gifDatabase.getAllGifs();
    
    if (gifs.length === 0) {
      return {
        totalGifs: 0,
        totalSize: 0,
        averageSize: 0,
        largestGif: null,
        oldestGif: null,
        sizeDistribution: []
      };
    }

    const totalSize = gifs.reduce((sum, gif) => sum + gif.fileSize, 0);
    const averageSize = totalSize / gifs.length;
    
    const largestGif = gifs.reduce((largest, gif) => 
      gif.fileSize > (largest?.fileSize || 0) ? gif : largest
    );
    
    const now = Date.now();
    const oldestGif = gifs.reduce((oldest, gif) => {
      const age = now - new Date(gif.createdAt).getTime();
      return age > (oldest?.age || 0) ? { id: gif.id, age } : oldest;
    }, null as { id: string; age: number } | null);

    const sizeDistribution = this.calculateSizeDistribution(gifs);

    return {
      totalGifs: gifs.length,
      totalSize,
      averageSize,
      largestGif: largestGif ? { id: largestGif.id, size: largestGif.fileSize } : null,
      oldestGif,
      sizeDistribution
    };
  }

  async getCleanupSuggestions(): Promise<CleanupSuggestion[]> {
    const suggestions: CleanupSuggestion[] = [];
    const gifs = await gifDatabase.getAllGifs();
    const now = Date.now();

    // Suggestion 1: Old GIFs
    const oldGifs = gifs.filter(gif => {
      const age = now - new Date(gif.createdAt).getTime();
      return age > this.cleanupPolicy.olderThanDays * 24 * 60 * 60 * 1000;
    });

    if (oldGifs.length > 0) {
      const estimatedSavings = oldGifs.reduce((sum, gif) => sum + gif.fileSize, 0);
      suggestions.push({
        type: 'old-gifs',
        count: oldGifs.length,
        estimatedSavings,
        description: `${oldGifs.length} GIFs older than ${this.cleanupPolicy.olderThanDays} days`,
        action: async () => {
          let deleted = 0;
          for (const gif of oldGifs) {
            await gifDatabase.deleteGif(gif.id);
            deleted++;
          }
          return deleted;
        }
      });
    }

    // Suggestion 2: Large GIFs (over 10MB)
    const largeGifs = gifs.filter(gif => gif.fileSize > 10 * 1024 * 1024);
    if (largeGifs.length > 0) {
      const estimatedSavings = largeGifs.reduce((sum, gif) => sum + gif.fileSize, 0);
      suggestions.push({
        type: 'large-gifs',
        count: largeGifs.length,
        estimatedSavings,
        description: `${largeGifs.length} large GIFs (over 10MB)`,
        action: async () => {
          let deleted = 0;
          for (const gif of largeGifs) {
            await gifDatabase.deleteGif(gif.id);
            deleted++;
          }
          return deleted;
        }
      });
    }

    // Suggestion 3: Unused GIFs (no tags, no description, old)
    const unusedGifs = gifs.filter(gif => {
      const age = now - new Date(gif.createdAt).getTime();
      const isOld = age > 7 * 24 * 60 * 60 * 1000; // 7 days
      const hasNoTags = gif.tags.length === 0;
      const hasNoDescription = !gif.description;
      return isOld && hasNoTags && hasNoDescription;
    });

    if (unusedGifs.length > 0) {
      const estimatedSavings = unusedGifs.reduce((sum, gif) => sum + gif.fileSize, 0);
      suggestions.push({
        type: 'unused-gifs',
        count: unusedGifs.length,
        estimatedSavings,
        description: `${unusedGifs.length} unused GIFs (no tags, old)`,
        action: async () => {
          let deleted = 0;
          for (const gif of unusedGifs) {
            await gifDatabase.deleteGif(gif.id);
            deleted++;
          }
          return deleted;
        }
      });
    }

    return suggestions;
  }

  async performAutoCleanup(): Promise<{
    success: boolean;
    gifsDeleted: number;
    spaceReclaimed: number;
    error?: string;
  }> {
    if (!this.cleanupPolicy.enabled) {
      return { success: false, gifsDeleted: 0, spaceReclaimed: 0, error: 'Auto-cleanup is disabled' };
    }

    const quotaStatus = await this.getQuotaStatus();
    
    if (quotaStatus.percentage < this.cleanupPolicy.thresholdPercentage) {
      return { success: true, gifsDeleted: 0, spaceReclaimed: 0 };
    }

    if (this.cleanupPolicy.requireUserConsent) {
      this.notifyListeners({
        type: 'storage-quota-changed',
        data: {
          used: quotaStatus.used,
          total: quotaStatus.total,
          available: quotaStatus.available
        }
      });
      return { success: false, gifsDeleted: 0, spaceReclaimed: 0, error: 'User consent required' };
    }

    const suggestions = await this.getCleanupSuggestions();
    let gifsDeleted = 0;
    let spaceReclaimed = 0;

    // Start with old GIFs
    const oldGifsSuggestion = suggestions.find(s => s.type === 'old-gifs');
    if (oldGifsSuggestion) {
      const deleted = await oldGifsSuggestion.action();
      gifsDeleted += deleted;
      spaceReclaimed += oldGifsSuggestion.estimatedSavings;
    }

    // Check if we've freed enough space
    const newQuotaStatus = await this.getQuotaStatus();
    if (newQuotaStatus.percentage <= this.cleanupPolicy.targetPercentage) {
      return { success: true, gifsDeleted, spaceReclaimed };
    }

    // If not, clean up unused GIFs
    const unusedGifsSuggestion = suggestions.find(s => s.type === 'unused-gifs');
    if (unusedGifsSuggestion) {
      const deleted = await unusedGifsSuggestion.action();
      gifsDeleted += deleted;
      spaceReclaimed += unusedGifsSuggestion.estimatedSavings;
    }

    return { success: true, gifsDeleted, spaceReclaimed };
  }

  setCleanupPolicy(policy: Partial<CleanupPolicy>): void {
    this.cleanupPolicy = { ...this.cleanupPolicy, ...policy };
  }

  getCleanupPolicy(): CleanupPolicy {
    return { ...this.cleanupPolicy };
  }

  startMonitoring(intervalMs: number = 60000): void {
    this.stopMonitoring();
    
    this.checkInterval = window.setInterval(async () => {
      const status = await this.getQuotaStatus();
      
      if (status.status === 'critical' && this.cleanupPolicy.enabled) {
        await this.performAutoCleanup();
      } else if (status.status === 'warning') {
        this.notifyListeners({
          type: 'storage-quota-changed',
          data: {
            used: status.used,
            total: status.total,
            available: status.available
          }
        });
      }
    }, intervalMs);

    // Initial check
    this.getQuotaStatus();
  }

  stopMonitoring(): void {
    if (this.checkInterval !== null) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  addEventListener(listener: StorageEventListener): void {
    this.listeners.add(listener);
  }

  removeEventListener(listener: StorageEventListener): void {
    this.listeners.delete(listener);
  }

  private notifyListeners(event: Parameters<StorageEventListener>[0]): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in storage event listener:', error);
      }
    });
  }

  private checkForQuotaChanges(current: QuotaStatus): void {
    if (!this.lastQuotaCheck) {
      this.lastQuotaCheck = {
        used: current.used,
        total: current.total,
        available: current.available
      };
      return;
    }

    const significantChange = Math.abs(current.percentage - (this.lastQuotaCheck.used / this.lastQuotaCheck.total * 100)) > 5;

    if (significantChange) {
      this.notifyListeners({
        type: 'storage-quota-changed',
        data: {
          used: current.used,
          total: current.total,
          available: current.available
        }
      });
      
      this.lastQuotaCheck = {
        used: current.used,
        total: current.total,
        available: current.available
      };
    }
  }

  private calculateSizeDistribution(gifs: Array<{ fileSize: number }>): { range: string; count: number }[] {
    const ranges = [
      { label: '<1MB', min: 0, max: 1024 * 1024 },
      { label: '1-5MB', min: 1024 * 1024, max: 5 * 1024 * 1024 },
      { label: '5-10MB', min: 5 * 1024 * 1024, max: 10 * 1024 * 1024 },
      { label: '10-20MB', min: 10 * 1024 * 1024, max: 20 * 1024 * 1024 },
      { label: '>20MB', min: 20 * 1024 * 1024, max: Number.MAX_SAFE_INTEGER }
    ];

    return ranges.map(range => ({
      range: range.label,
      count: gifs.filter(gif => gif.fileSize >= range.min && gif.fileSize < range.max).length
    }));
  }

  async persist(): Promise<boolean> {
    try {
      if (navigator.storage && navigator.storage.persist) {
        const isPersisted = await navigator.storage.persist();
        return isPersisted;
      }
      return false;
    } catch (error) {
      console.error('Failed to persist storage:', error);
      return false;
    }
  }

  async isPersisted(): Promise<boolean> {
    try {
      if (navigator.storage && navigator.storage.persisted) {
        const persisted = await navigator.storage.persisted();
        return persisted;
      }
      return false;
    } catch (error) {
      console.error('Failed to check persistence:', error);
      return false;
    }
  }
}

export const quotaManager = new QuotaManager();