/**
 * Task management system for coordinating GIF processing operations
 * Handles task queuing, concurrency control, resource management, and error recovery
 */

import { ProgressTracker, TrackerInstance, ProgressEvent } from './progress-tracker';
import { FrameExtractor, FrameExtractionConfig, FrameExtractionResult } from './frame-extractor';
import { GifEncoder, GifEncodingConfig, GifEncodingResult } from './gif-encoder';

export interface ProcessingTask {
  id: string;
  type: 'frame-extraction' | 'gif-encoding' | 'composite';
  priority: number; // Higher number = higher priority
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  config: TaskConfig;
  result?: TaskResult;
  error?: Error;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  retryCount: number;
  dependencies?: string[]; // Task IDs that must complete first
  metadata?: Record<string, unknown>;
}

export type TaskConfig = 
  | FrameExtractionTaskConfig
  | GifEncodingTaskConfig
  | CompositeTaskConfig;

export interface FrameExtractionTaskConfig {
  type: 'frame-extraction';
  videoElement: HTMLVideoElement;
  extractionConfig: FrameExtractionConfig;
}

export interface GifEncodingTaskConfig {
  type: 'gif-encoding';
  frames: FrameExtractionResult;
  encodingConfig: GifEncodingConfig;
}

export interface CompositeTaskConfig {
  type: 'composite';
  videoElement: HTMLVideoElement;
  extractionConfig: FrameExtractionConfig;
  encodingConfig: GifEncodingConfig;
}

export type TaskResult = 
  | FrameExtractionResult
  | GifEncodingResult
  | CompositeTaskResult;

export interface CompositeTaskResult {
  frames: FrameExtractionResult;
  gif: GifEncodingResult;
}

export interface TaskManagerOptions {
  maxConcurrentTasks?: number;
  maxRetries?: number;
  retryDelay?: number;
  taskTimeout?: number;
  memoryThreshold?: number; // Percentage of memory usage to pause new tasks
  enableAutoCleanup?: boolean;
  cleanupDelay?: number;
}

export interface TaskEventListener {
  (task: ProcessingTask, event: TaskEvent): void;
}

export type TaskEvent = 
  | { type: 'queued' }
  | { type: 'started' }
  | { type: 'progress'; data: ProgressEvent }
  | { type: 'completed'; result: TaskResult }
  | { type: 'failed'; error: Error }
  | { type: 'cancelled' }
  | { type: 'retrying'; attempt: number };

export class TaskManager {
  private tasks = new Map<string, ProcessingTask>();
  private taskQueue: ProcessingTask[] = [];
  private runningTasks = new Set<string>();
  private progressTracker: ProgressTracker;
  private frameExtractor: FrameExtractor;
  private gifEncoder: GifEncoder;
  private eventListeners = new Map<string, Set<TaskEventListener>>();
  private taskTrackers = new Map<string, TrackerInstance>();
  private readonly options: Required<TaskManagerOptions>;
  private isProcessing = false;
  private memoryCheckInterval: number | null = null;
  private cleanupTimeouts = new Map<string, number>();

  constructor(options: TaskManagerOptions = {}) {
    this.options = {
      maxConcurrentTasks: options.maxConcurrentTasks ?? 2,
      maxRetries: options.maxRetries ?? 3,
      retryDelay: options.retryDelay ?? 1000,
      taskTimeout: options.taskTimeout ?? 60000,
      memoryThreshold: options.memoryThreshold ?? 85,
      enableAutoCleanup: options.enableAutoCleanup ?? true,
      cleanupDelay: options.cleanupDelay ?? 30000
    };

    this.progressTracker = new ProgressTracker({
      enableMemoryMonitoring: true,
      autoCleanupOnComplete: false
    });

    this.frameExtractor = new FrameExtractor();
    this.gifEncoder = new GifEncoder();

    this.startMemoryMonitoring();
  }

  /**
   * Queue a new task for processing
   */
  async queueTask(config: TaskConfig, metadata?: Record<string, unknown>): Promise<string> {
    const taskId = this.generateTaskId();
    
    const task: ProcessingTask = {
      id: taskId,
      type: config.type,
      priority: (metadata?.priority as number) ?? 0,
      status: 'pending',
      config,
      createdAt: Date.now(),
      retryCount: 0,
      metadata
    };

    // Handle dependencies
    if (metadata?.dependencies) {
      task.dependencies = metadata.dependencies as string[];
    }

    this.tasks.set(taskId, task);
    this.taskQueue.push(task);
    
    // Sort queue by priority (higher priority first)
    this.taskQueue.sort((a, b) => b.priority - a.priority);

    this.emitTaskEvent(task, { type: 'queued' });
    
    // Start processing if not already running
    if (!this.isProcessing) {
      this.startProcessing();
    }

    return taskId;
  }

  /**
   * Queue a composite task (extraction + encoding)
   */
  async queueCompositeTask(
    videoElement: HTMLVideoElement,
    extractionConfig: FrameExtractionConfig,
    encodingConfig: GifEncodingConfig,
    metadata?: Record<string, unknown>
  ): Promise<string> {
    const config: CompositeTaskConfig = {
      type: 'composite',
      videoElement,
      extractionConfig,
      encodingConfig
    };

    return this.queueTask(config, metadata);
  }

  /**
   * Cancel a task
   */
  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    if (task.status === 'running') {
      // Cancel running task
      const tracker = this.taskTrackers.get(taskId);
      if (tracker) {
        tracker.cancel();
      }
    } else if (task.status === 'pending') {
      // Remove from queue
      const index = this.taskQueue.findIndex(t => t.id === taskId);
      if (index !== -1) {
        this.taskQueue.splice(index, 1);
      }
    }

    task.status = 'cancelled';
    task.completedAt = Date.now();
    
    this.emitTaskEvent(task, { type: 'cancelled' });
    this.scheduleCleanup(taskId);

    return true;
  }

  /**
   * Get task status and result
   */
  getTask(taskId: string): ProcessingTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks with optional filtering
   */
  getTasks(filter?: Partial<ProcessingTask>): ProcessingTask[] {
    let tasks = Array.from(this.tasks.values());
    
    if (filter) {
      tasks = tasks.filter(task => {
        for (const [key, value] of Object.entries(filter)) {
          if (task[key as keyof ProcessingTask] !== value) {
            return false;
          }
        }
        return true;
      });
    }

    return tasks;
  }

  /**
   * Listen to task events
   */
  addEventListener(taskId: string | '*', listener: TaskEventListener): () => void {
    if (!this.eventListeners.has(taskId)) {
      this.eventListeners.set(taskId, new Set());
    }
    
    this.eventListeners.get(taskId)!.add(listener);

    // Return unsubscribe function
    return () => {
      const listeners = this.eventListeners.get(taskId);
      if (listeners) {
        listeners.delete(listener);
        if (listeners.size === 0) {
          this.eventListeners.delete(taskId);
        }
      }
    };
  }

  /**
   * Start processing queued tasks
   */
  private async startProcessing(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.taskQueue.length > 0 || this.runningTasks.size > 0) {
      // Check if we can start new tasks
      while (
        this.runningTasks.size < this.options.maxConcurrentTasks &&
        this.taskQueue.length > 0 &&
        await this.canStartNewTask()
      ) {
        const task = this.getNextTask();
        if (task) {
          this.processTask(task).catch(error => {
            console.error('Task processing error:', error);
          });
        }
      }

      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.isProcessing = false;
  }

  /**
   * Get next task from queue considering dependencies
   */
  private getNextTask(): ProcessingTask | null {
    for (let i = 0; i < this.taskQueue.length; i++) {
      const task = this.taskQueue[i];
      
      // Check if dependencies are satisfied
      if (this.areDependenciesSatisfied(task)) {
        this.taskQueue.splice(i, 1);
        return task;
      }
    }
    
    return null;
  }

  /**
   * Check if task dependencies are satisfied
   */
  private areDependenciesSatisfied(task: ProcessingTask): boolean {
    if (!task.dependencies || task.dependencies.length === 0) {
      return true;
    }

    for (const depId of task.dependencies) {
      const depTask = this.tasks.get(depId);
      if (!depTask || depTask.status !== 'completed') {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if we can start a new task based on memory usage
   */
  private async canStartNewTask(): Promise<boolean> {
    const memoryMetrics = await this.progressTracker.getMemoryMetrics();
    return memoryMetrics.percentage < this.options.memoryThreshold;
  }

  /**
   * Process a single task
   */
  private async processTask(task: ProcessingTask): Promise<void> {
    task.status = 'running';
    task.startedAt = Date.now();
    this.runningTasks.add(task.id);
    
    this.emitTaskEvent(task, { type: 'started' });

    try {
      // Create progress tracker for this task
      const tracker = this.progressTracker.createTracker(
        task.id,
        task.type === 'composite' ? 'processing' : task.type,
        100,
        `Processing ${task.type} task`
      );
      
      this.taskTrackers.set(task.id, tracker);

      // Subscribe to progress events
      const unsubscribe = this.progressTracker.subscribe(task.id, (event) => {
        this.emitTaskEvent(task, { type: 'progress', data: event });
      });

      // Set timeout
      const timeoutId = setTimeout(() => {
        if (task.status === 'running') {
          tracker.error(new Error('Task timeout'));
        }
      }, this.options.taskTimeout);

      try {
        // Process based on task type
        const result = await this.executeTask(task, tracker);
        
        clearTimeout(timeoutId);
        
        task.result = result;
        task.status = 'completed';
        task.completedAt = Date.now();
        
        tracker.complete();
        this.emitTaskEvent(task, { type: 'completed', result });
        
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      } finally {
        unsubscribe();
      }

    } catch (error) {
      await this.handleTaskError(task, error as Error);
    } finally {
      this.runningTasks.delete(task.id);
      this.taskTrackers.delete(task.id);
      
      if (this.options.enableAutoCleanup) {
        this.scheduleCleanup(task.id);
      }
    }
  }

  /**
   * Execute task based on type
   */
  private async executeTask(task: ProcessingTask, tracker: TrackerInstance): Promise<TaskResult> {
    const cancellationToken = tracker.getCancellationToken();

    switch (task.config.type) {
      case 'frame-extraction': {
        const config = task.config as FrameExtractionTaskConfig;
        return await this.frameExtractor.extractFrames(
          config.videoElement,
          config.extractionConfig,
          (progress) => {
            tracker.update(
              (progress.framesExtracted / progress.totalFrames) * 100,
              `Extracted ${progress.framesExtracted} of ${progress.totalFrames} frames`
            );
            tracker.updateDetails({
              framesProcessed: progress.framesExtracted,
              totalFrames: progress.totalFrames
            });
          }
        );
      }

      case 'gif-encoding': {
        const config = task.config as GifEncodingTaskConfig;
        return await this.gifEncoder.encodeGif(
          config.frames,
          {
            ...config.encodingConfig,
            onProgress: (progress) => {
              tracker.update(
                progress.percentage,
                progress.currentOperation || 'Encoding GIF'
              );
              tracker.updateDetails({
                currentStep: progress.currentOperation,
                framesProcessed: progress.frameIndex,
                totalFrames: progress.totalFrames
              });
            }
          }
        );
      }

      case 'composite': {
        const config = task.config as CompositeTaskConfig;
        
        // Phase 1: Frame extraction (50% of progress)
        tracker.update(0, 'Starting frame extraction');
        const frames = await this.frameExtractor.extractFrames(
          config.videoElement,
          config.extractionConfig,
          (progress) => {
            const percentage = (progress.framesExtracted / progress.totalFrames) * 50;
            tracker.update(percentage, `Extracting frames: ${progress.framesExtracted}/${progress.totalFrames}`);
          }
        );

        if (cancellationToken.isCancelled) {
          throw new Error('Task cancelled');
        }

        // Phase 2: GIF encoding (50% of progress)
        tracker.update(50, 'Starting GIF encoding');
        const gif = await this.gifEncoder.encodeGif(
          frames,
          {
            ...config.encodingConfig,
            onProgress: (progress) => {
              const percentage = 50 + (progress.percentage * 0.5);
              tracker.update(percentage, progress.currentOperation || 'Encoding GIF');
            }
          }
        );

        return { frames, gif };
      }

      default:
        throw new Error(`Unknown task type: ${(task.config as unknown as { type: string }).type}`);
    }
  }

  /**
   * Handle task error with retry logic
   */
  private async handleTaskError(task: ProcessingTask, error: Error): Promise<void> {
    task.error = error;
    
    if (task.retryCount < this.options.maxRetries) {
      task.retryCount++;
      task.status = 'pending';
      
      this.emitTaskEvent(task, { type: 'retrying', attempt: task.retryCount });
      
      // Re-queue with delay
      setTimeout(() => {
        this.taskQueue.push(task);
        if (!this.isProcessing) {
          this.startProcessing();
        }
      }, this.options.retryDelay * task.retryCount);
      
    } else {
      task.status = 'failed';
      task.completedAt = Date.now();
      
      this.emitTaskEvent(task, { type: 'failed', error });
    }
  }

  /**
   * Schedule task cleanup
   */
  private scheduleCleanup(taskId: string): void {
    if (this.cleanupTimeouts.has(taskId)) {
      clearTimeout(this.cleanupTimeouts.get(taskId));
    }

    const timeoutId = window.setTimeout(() => {
      this.tasks.delete(taskId);
      this.cleanupTimeouts.delete(taskId);
    }, this.options.cleanupDelay);

    this.cleanupTimeouts.set(taskId, timeoutId);
  }

  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    if (this.memoryCheckInterval) return;

    this.memoryCheckInterval = window.setInterval(async () => {
      const metrics = await this.progressTracker.getMemoryMetrics();
      
      // Pause queue if memory is too high
      if (metrics.percentage > this.options.memoryThreshold && this.taskQueue.length > 0) {
        console.warn(`Memory usage high (${metrics.percentage.toFixed(1)}%), pausing task queue`);
      }

      // Force cleanup if critical
      if (metrics.percentage > 95) {
        this.forceCleanup();
      }
    }, 5000);
  }

  /**
   * Force cleanup of completed tasks
   */
  private forceCleanup(): void {
    const now = Date.now();
    const tasksToDelete: string[] = [];

    for (const [id, task] of this.tasks) {
      if (
        (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') &&
        task.completedAt &&
        now - task.completedAt > 5000
      ) {
        tasksToDelete.push(id);
      }
    }

    for (const id of tasksToDelete) {
      this.tasks.delete(id);
      
      if (this.cleanupTimeouts.has(id)) {
        clearTimeout(this.cleanupTimeouts.get(id));
        this.cleanupTimeouts.delete(id);
      }
    }

    if (tasksToDelete.length > 0) {
      // Tasks have been removed from the queue
    }
  }

  /**
   * Emit task event to listeners
   */
  private emitTaskEvent(task: ProcessingTask, event: TaskEvent): void {
    // Notify specific task listeners
    const taskListeners = this.eventListeners.get(task.id);
    if (taskListeners) {
      for (const listener of taskListeners) {
        try {
          listener(task, event);
        } catch (error) {
          console.error('Task event listener error:', error);
        }
      }
    }

    // Notify wildcard listeners
    const wildcardListeners = this.eventListeners.get('*');
    if (wildcardListeners) {
      for (const listener of wildcardListeners) {
        try {
          listener(task, event);
        } catch (error) {
          console.error('Task event listener error:', error);
        }
      }
    }
  }

  /**
   * Generate unique task ID
   */
  private generateTaskId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get queue statistics
   */
  getStatistics(): {
    pending: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
    total: number;
  } {
    const stats = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      total: this.tasks.size
    };

    for (const task of this.tasks.values()) {
      stats[task.status]++;
    }

    return stats;
  }

  /**
   * Clear all completed/failed/cancelled tasks
   */
  clearCompleted(): number {
    const tasksToDelete: string[] = [];

    for (const [id, task] of this.tasks) {
      if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
        tasksToDelete.push(id);
      }
    }

    for (const id of tasksToDelete) {
      this.tasks.delete(id);
      
      if (this.cleanupTimeouts.has(id)) {
        clearTimeout(this.cleanupTimeouts.get(id));
        this.cleanupTimeouts.delete(id);
      }
    }

    return tasksToDelete.length;
  }

  /**
   * Destroy and cleanup all resources
   */
  destroy(): void {
    // Cancel all running tasks
    for (const taskId of this.runningTasks) {
      this.cancelTask(taskId);
    }

    // Clear queue
    this.taskQueue = [];

    // Stop memory monitoring
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }

    // Clear all cleanup timeouts
    for (const timeoutId of this.cleanupTimeouts.values()) {
      clearTimeout(timeoutId);
    }
    this.cleanupTimeouts.clear();

    // Cleanup progress tracker
    this.progressTracker.destroy();

    // Clear all data
    this.tasks.clear();
    this.eventListeners.clear();
    this.taskTrackers.clear();
  }
}

/**
 * Global task manager instance for shared use
 */
export const globalTaskManager = new TaskManager();