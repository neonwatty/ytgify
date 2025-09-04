/**
 * Progress tracking system for GIF processing operations
 * Provides unified progress monitoring, memory usage tracking, and cancellation support
 * for frame extraction and GIF encoding processes
 */

export interface ProgressEvent {
  type: 'start' | 'progress' | 'complete' | 'error' | 'cancel';
  taskId: string;
  taskType: 'frame-extraction' | 'gif-encoding' | 'processing' | 'custom';
  timestamp: number;
  data: ProgressData;
}

export interface ProgressData {
  current: number;
  total: number;
  percentage: number;
  message: string;
  details?: ProgressDetails;
  memoryUsage?: MemoryMetrics;
  estimatedTimeRemaining?: number;
  elapsedTime: number;
}

export interface ProgressDetails {
  framesProcessed?: number;
  totalFrames?: number;
  currentStep?: string;
  subProgress?: SubProgress[];
  warnings?: string[];
}

export interface SubProgress {
  name: string;
  current: number;
  total: number;
  percentage: number;
}

export interface MemoryMetrics {
  used: number;
  limit: number;
  percentage: number;
  arrayBuffers: number;
  imageData: number;
}

export interface ProgressSubscriber {
  (event: ProgressEvent): void;
}

export interface CancellationToken {
  isCancelled: boolean;
  signal: AbortSignal;
  cancel: () => void;
  onCancel: (callback: () => void) => void;
}

export interface ProgressTrackerOptions {
  enableMemoryMonitoring?: boolean;
  memoryCheckInterval?: number;
  smoothingFactor?: number; // For ETA calculation smoothing
  autoCleanupOnComplete?: boolean;
}

export class ProgressTracker {
  private subscribers = new Map<string, Set<ProgressSubscriber>>();
  private activeTrackers = new Map<string, ActiveTracker>();
  private memoryMonitorInterval: number | null = null;
  private readonly options: Required<ProgressTrackerOptions>;

  constructor(options: ProgressTrackerOptions = {}) {
    this.options = {
      enableMemoryMonitoring: options.enableMemoryMonitoring ?? true,
      memoryCheckInterval: options.memoryCheckInterval ?? 1000,
      smoothingFactor: options.smoothingFactor ?? 0.3,
      autoCleanupOnComplete: options.autoCleanupOnComplete ?? true
    };

    if (this.options.enableMemoryMonitoring) {
      this.startMemoryMonitoring();
    }
  }

  /**
   * Create a new progress tracker for a specific task
   */
  createTracker(
    taskId: string,
    taskType: 'frame-extraction' | 'gif-encoding' | 'processing' | 'custom',
    total: number,
    message?: string
  ): TrackerInstance {
    const tracker = new ActiveTracker(taskId, taskType, total, message || '');
    this.activeTrackers.set(taskId, tracker);

    // Emit start event
    this.emitEvent({
      type: 'start',
      taskId,
      taskType,
      timestamp: Date.now(),
      data: tracker.getProgressData()
    });

    // Return tracker instance for direct updates
    return {
      update: (current: number, message?: string) => this.updateProgress(taskId, current, message),
      updateDetails: (details: Partial<ProgressDetails>) => this.updateDetails(taskId, details),
      complete: () => this.completeTask(taskId),
      error: (error: Error) => this.errorTask(taskId, error),
      cancel: () => this.cancelTask(taskId),
      getCancellationToken: () => tracker.cancellationToken
    };
  }

  /**
   * Update progress for a specific task
   */
  updateProgress(taskId: string, current: number, message?: string): void {
    const tracker = this.activeTrackers.get(taskId);
    if (!tracker) return;

    tracker.update(current, message);
    
    this.emitEvent({
      type: 'progress',
      taskId,
      taskType: tracker.taskType,
      timestamp: Date.now(),
      data: tracker.getProgressData()
    });
  }

  /**
   * Update additional details for a task
   */
  updateDetails(taskId: string, details: Partial<ProgressDetails>): void {
    const tracker = this.activeTrackers.get(taskId);
    if (!tracker) return;

    tracker.updateDetails(details);
    
    this.emitEvent({
      type: 'progress',
      taskId,
      taskType: tracker.taskType,
      timestamp: Date.now(),
      data: tracker.getProgressData()
    });
  }

  /**
   * Complete a task
   */
  completeTask(taskId: string): void {
    const tracker = this.activeTrackers.get(taskId);
    if (!tracker) return;

    tracker.complete();
    
    this.emitEvent({
      type: 'complete',
      taskId,
      taskType: tracker.taskType,
      timestamp: Date.now(),
      data: tracker.getProgressData()
    });

    if (this.options.autoCleanupOnComplete) {
      this.cleanupTracker(taskId);
    }
  }

  /**
   * Mark task as errored
   */
  errorTask(taskId: string, error: Error): void {
    const tracker = this.activeTrackers.get(taskId);
    if (!tracker) return;

    tracker.error(error);
    
    this.emitEvent({
      type: 'error',
      taskId,
      taskType: tracker.taskType,
      timestamp: Date.now(),
      data: {
        ...tracker.getProgressData(),
        message: error.message
      }
    });

    if (this.options.autoCleanupOnComplete) {
      this.cleanupTracker(taskId);
    }
  }

  /**
   * Cancel a task
   */
  cancelTask(taskId: string): void {
    const tracker = this.activeTrackers.get(taskId);
    if (!tracker) return;

    tracker.cancel();
    
    this.emitEvent({
      type: 'cancel',
      taskId,
      taskType: tracker.taskType,
      timestamp: Date.now(),
      data: tracker.getProgressData()
    });

    this.cleanupTracker(taskId);
  }

  /**
   * Subscribe to progress events
   */
  subscribe(taskId: string | '*', subscriber: ProgressSubscriber): () => void {
    if (!this.subscribers.has(taskId)) {
      this.subscribers.set(taskId, new Set());
    }
    
    this.subscribers.get(taskId)!.add(subscriber);

    // Return unsubscribe function
    return () => {
      const subs = this.subscribers.get(taskId);
      if (subs) {
        subs.delete(subscriber);
        if (subs.size === 0) {
          this.subscribers.delete(taskId);
        }
      }
    };
  }

  /**
   * Get current memory metrics
   */
  async getMemoryMetrics(): Promise<MemoryMetrics> {
    if (!('memory' in performance)) {
      return {
        used: 0,
        limit: 0,
        percentage: 0,
        arrayBuffers: 0,
        imageData: 0
      };
    }

    const memory = (performance as unknown as { memory: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
    const used = memory.usedJSHeapSize;
    const limit = memory.jsHeapSizeLimit;
    
    // Estimate memory usage for specific data types
    const arrayBufferSize = 0;
    let imageDataSize = 0;

    // Calculate from active trackers
    for (const tracker of this.activeTrackers.values()) {
      const details = tracker.getProgressData().details;
      if (details?.framesProcessed) {
        // Rough estimate: 4 bytes per pixel for RGBA
        imageDataSize += details.framesProcessed * 1920 * 1080 * 4; // Assume HD frames
      }
    }

    return {
      used,
      limit,
      percentage: (used / limit) * 100,
      arrayBuffers: arrayBufferSize,
      imageData: imageDataSize
    };
  }

  /**
   * Cleanup tracker and free resources
   */
  private cleanupTracker(taskId: string): void {
    const tracker = this.activeTrackers.get(taskId);
    if (tracker) {
      tracker.cleanup();
      this.activeTrackers.delete(taskId);
    }
  }

  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    if (this.memoryMonitorInterval) return;

    this.memoryMonitorInterval = window.setInterval(async () => {
      const metrics = await this.getMemoryMetrics();
      
      // Update all active trackers with memory metrics
      for (const tracker of this.activeTrackers.values()) {
        tracker.updateMemoryMetrics(metrics);
      }

      // Check for high memory usage
      if (metrics.percentage > 90) {
        console.warn('High memory usage detected:', metrics);
        // Could trigger automatic cleanup or warnings
      }
    }, this.options.memoryCheckInterval);
  }

  /**
   * Stop memory monitoring
   */
  stopMemoryMonitoring(): void {
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
      this.memoryMonitorInterval = null;
    }
  }

  /**
   * Emit event to subscribers
   */
  private emitEvent(event: ProgressEvent): void {
    // Notify specific task subscribers
    const taskSubs = this.subscribers.get(event.taskId);
    if (taskSubs) {
      for (const sub of taskSubs) {
        try {
          sub(event);
        } catch (error) {
          console.error('Progress subscriber error:', error);
        }
      }
    }

    // Notify wildcard subscribers
    const wildcardSubs = this.subscribers.get('*');
    if (wildcardSubs) {
      for (const sub of wildcardSubs) {
        try {
          sub(event);
        } catch (error) {
          console.error('Progress subscriber error:', error);
        }
      }
    }
  }

  /**
   * Get all active trackers
   */
  getActiveTrackers(): Map<string, ActiveTracker> {
    return new Map(this.activeTrackers);
  }

  /**
   * Cleanup all resources
   */
  destroy(): void {
    this.stopMemoryMonitoring();
    
    // Cancel all active tasks
    for (const taskId of this.activeTrackers.keys()) {
      this.cancelTask(taskId);
    }

    this.subscribers.clear();
    this.activeTrackers.clear();
  }
}

/**
 * Internal tracker implementation
 */
class ActiveTracker {
  readonly taskId: string;
  readonly taskType: 'frame-extraction' | 'gif-encoding' | 'processing' | 'custom';
  readonly cancellationToken: CancellationToken;
  
  private current = 0;
  private total: number;
  private message: string;
  private details: ProgressDetails = {};
  private memoryMetrics?: MemoryMetrics;
  private startTime: number;
  private lastUpdateTime: number;
  private progressHistory: number[] = [];
  private readonly abortController: AbortController;

  constructor(taskId: string, taskType: 'frame-extraction' | 'gif-encoding' | 'processing' | 'custom', total: number, message: string) {
    this.taskId = taskId;
    this.taskType = taskType;
    this.total = total;
    this.message = message;
    this.startTime = Date.now();
    this.lastUpdateTime = this.startTime;
    
    this.abortController = new AbortController();
    
    this.cancellationToken = {
      isCancelled: false,
      signal: this.abortController.signal,
      cancel: () => this.cancel(),
      onCancel: (callback: () => void) => {
        this.abortController.signal.addEventListener('abort', callback);
      }
    };
  }

  update(current: number, message?: string): void {
    this.current = Math.min(current, this.total);
    if (message) this.message = message;
    
    this.lastUpdateTime = Date.now();
    this.progressHistory.push(this.current);
    
    // Keep history limited to last 10 updates for ETA calculation
    if (this.progressHistory.length > 10) {
      this.progressHistory.shift();
    }
  }

  updateDetails(details: Partial<ProgressDetails>): void {
    this.details = { ...this.details, ...details };
  }

  updateMemoryMetrics(metrics: MemoryMetrics): void {
    this.memoryMetrics = metrics;
  }

  complete(): void {
    this.current = this.total;
    this.message = 'Complete';
  }

  error(error: Error): void {
    this.message = `Error: ${error.message}`;
  }

  cancel(): void {
    this.cancellationToken.isCancelled = true;
    this.abortController.abort();
    this.message = 'Cancelled';
  }

  getProgressData(): ProgressData {
    const percentage = this.total > 0 ? (this.current / this.total) * 100 : 0;
    const elapsedTime = Date.now() - this.startTime;
    
    return {
      current: this.current,
      total: this.total,
      percentage,
      message: this.message,
      details: this.details,
      memoryUsage: this.memoryMetrics,
      estimatedTimeRemaining: this.calculateETA(),
      elapsedTime
    };
  }

  private calculateETA(): number | undefined {
    if (this.progressHistory.length < 2) return undefined;
    
    const recentProgress = this.progressHistory[this.progressHistory.length - 1] - this.progressHistory[0];
    const timeForRecentProgress = Date.now() - (this.startTime + (this.progressHistory.length - 1) * 1000);
    
    if (recentProgress <= 0) return undefined;
    
    const remainingProgress = this.total - this.current;
    const progressRate = recentProgress / timeForRecentProgress;
    
    return remainingProgress / progressRate;
  }

  cleanup(): void {
    this.progressHistory = [];
    this.details = {};
    this.memoryMetrics = undefined;
  }
}

/**
 * Tracker instance returned to users
 */
export interface TrackerInstance {
  update: (current: number, message?: string) => void;
  updateDetails: (details: Partial<ProgressDetails>) => void;
  complete: () => void;
  error: (error: Error) => void;
  cancel: () => void;
  getCancellationToken: () => CancellationToken;
}

/**
 * Global progress tracker instance for shared use
 */
export const globalProgressTracker = new ProgressTracker();