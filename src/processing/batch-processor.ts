/**
 * Batch processing system for creating multiple GIFs from single video
 * Coordinates processing multiple segments with queue management and progress tracking
 */

import { TaskManager, ProcessingTask, CompositeTaskConfig } from './task-manager';
import { ProgressTracker } from './progress-tracker';
import { FrameExtractionConfig } from './frame-extractor';
import { GifEncodingConfig } from './gif-encoder';

export interface BatchJobConfig {
  id: string;
  videoElement: HTMLVideoElement;
  segments: BatchSegment[];
  globalEncodingOptions?: Partial<GifEncodingConfig>;
  priority?: number;
  metadata?: Record<string, unknown>;
}

export interface BatchSegment {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  extractionConfig: Partial<FrameExtractionConfig>;
  encodingConfig?: Partial<GifEncodingConfig>;
  priority?: number;
  metadata?: Record<string, unknown>;
}

export interface BatchJobResult {
  jobId: string;
  status: 'completed' | 'failed';
  results: Map<string, BatchSegmentResult>;
  errors: Map<string, Error>;
  totalProcessingTime: number;
  completedSegments: number;
  failedSegments: number;
  totalSegments: number;
  isPartial?: boolean;
}

export interface BatchSegmentResult {
  segmentId: string;
  taskId: string;
  gif: Blob;
  metadata: {
    width: number;
    height: number;
    duration: number;
    frameCount: number;
    fileSize: number;
    processingTime: number;
  };
}

export interface BatchProcessorOptions {
  maxConcurrentSegments?: number;
  maxRetries?: number;
  segmentTimeout?: number;
  enableResourceOptimization?: boolean;
  resourceCheckInterval?: number;
  memoryThreshold?: number;
  onSegmentComplete?: (result: BatchSegmentResult) => void;
  onSegmentError?: (segmentId: string, error: Error) => void;
  onJobProgress?: (jobId: string, progress: BatchProgress) => void;
}

export interface BatchProgress {
  jobId: string;
  completedSegments: number;
  totalSegments: number;
  percentage: number;
  currentlyProcessing: string[];
  estimatedTimeRemaining?: number;
  averageSegmentTime: number;
}

export interface BatchJob {
  id: string;
  config: BatchJobConfig;
  status: 'queued' | 'processing' | 'paused' | 'completed' | 'failed' | 'cancelled';
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  segmentTasks: Map<string, string>; // segmentId -> taskId
  results: Map<string, BatchSegmentResult>;
  errors: Map<string, Error>;
  progress: BatchProgress;
}

export class BatchProcessor {
  private taskManager: TaskManager;
  private progressTracker: ProgressTracker;
  private activeJobs = new Map<string, BatchJob>();
  private jobQueue: BatchJob[] = [];
  private readonly options: Required<BatchProcessorOptions>;
  private isProcessing = false;
  private resourceCheckInterval: number | null = null;
  private segmentTimingHistory: number[] = [];

  constructor(
    taskManager: TaskManager,
    progressTracker: ProgressTracker,
    options: BatchProcessorOptions = {}
  ) {
    this.taskManager = taskManager;
    this.progressTracker = progressTracker;

    this.options = {
      maxConcurrentSegments: options.maxConcurrentSegments ?? 3,
      maxRetries: options.maxRetries ?? 2,
      segmentTimeout: options.segmentTimeout ?? 120000,
      enableResourceOptimization: options.enableResourceOptimization ?? true,
      resourceCheckInterval: options.resourceCheckInterval ?? 5000,
      memoryThreshold: options.memoryThreshold ?? 80,
      onSegmentComplete: options.onSegmentComplete ?? (() => {}),
      onSegmentError: options.onSegmentError ?? (() => {}),
      onJobProgress: options.onJobProgress ?? (() => {})
    };

    if (this.options.enableResourceOptimization) {
      this.startResourceMonitoring();
    }
  }

  /**
   * Submit a batch job for processing
   */
  async submitJob(config: BatchJobConfig): Promise<string> {
    const job: BatchJob = {
      id: config.id,
      config,
      status: 'queued',
      createdAt: Date.now(),
      segmentTasks: new Map(),
      results: new Map(),
      errors: new Map(),
      progress: {
        jobId: config.id,
        completedSegments: 0,
        totalSegments: config.segments.length,
        percentage: 0,
        currentlyProcessing: [],
        averageSegmentTime: 0
      }
    };

    this.activeJobs.set(config.id, job);
    this.jobQueue.push(job);

    // Sort queue by priority
    this.jobQueue.sort((a, b) => (b.config.priority ?? 0) - (a.config.priority ?? 0));

    if (!this.isProcessing) {
      this.startProcessing();
    }

    return config.id;
  }

  /**
   * Cancel a batch job
   */
  cancelJob(jobId: string): boolean {
    const job = this.activeJobs.get(jobId);
    if (!job) return false;

    // Cancel all segment tasks
    for (const taskId of job.segmentTasks.values()) {
      this.taskManager.cancelTask(taskId);
    }

    job.status = 'cancelled';
    job.completedAt = Date.now();

    // Remove from queue if still queued
    const queueIndex = this.jobQueue.findIndex(j => j.id === jobId);
    if (queueIndex !== -1) {
      this.jobQueue.splice(queueIndex, 1);
    }

    return true;
  }

  /**
   * Pause a batch job
   */
  pauseJob(jobId: string): boolean {
    const job = this.activeJobs.get(jobId);
    if (!job || job.status !== 'processing') return false;

    job.status = 'paused';
    // Don't cancel running tasks, just pause new segment processing
    return true;
  }

  /**
   * Resume a paused batch job
   */
  resumeJob(jobId: string): boolean {
    const job = this.activeJobs.get(jobId);
    if (!job || job.status !== 'paused') return false;

    job.status = 'processing';
    
    if (!this.isProcessing) {
      this.startProcessing();
    }
    
    return true;
  }

  /**
   * Get job status and results
   */
  getJob(jobId: string): BatchJob | undefined {
    return this.activeJobs.get(jobId);
  }

  /**
   * Get all jobs with optional filtering
   */
  getJobs(filter?: Partial<Pick<BatchJob, 'status'>>): BatchJob[] {
    let jobs = Array.from(this.activeJobs.values());
    
    if (filter) {
      jobs = jobs.filter(job => {
        for (const [key, value] of Object.entries(filter)) {
          if (job[key as keyof BatchJob] !== value) {
            return false;
          }
        }
        return true;
      });
    }

    return jobs;
  }

  /**
   * Start processing queued jobs
   */
  private async startProcessing(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.jobQueue.length > 0) {
        const job = this.jobQueue.shift();
        if (!job) break;

        if (job.status === 'queued') {
          await this.processJob(job);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single batch job
   */
  private async processJob(job: BatchJob): Promise<void> {
    job.status = 'processing';
    job.startedAt = Date.now();

    try {
      const segmentPromises: Promise<void>[] = [];
      let activeSegments = 0;

      for (const segment of job.config.segments) {
        // Wait for slot availability
        while (activeSegments >= this.options.maxConcurrentSegments) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Check if job was paused or cancelled
        if (job.status !== 'processing') {
          break;
        }

        // Check resource availability
        if (this.options.enableResourceOptimization && !await this.canProcessMoreSegments()) {
          await this.waitForResourceAvailability();
        }

        activeSegments++;
        const segmentPromise = this.processSegment(job, segment)
          .finally(() => {
            activeSegments--;
          });

        segmentPromises.push(segmentPromise);
      }

      // Wait for all segments to complete
      await Promise.allSettled(segmentPromises);

      // Complete job
      this.completeJob(job);

    } catch (error) {
      this.failJob(job, error as Error);
    }
  }

  /**
   * Process a single segment
   */
  private async processSegment(job: BatchJob, segment: BatchSegment): Promise<void> {
    const startTime = Date.now();

    try {
      // Create task configuration
      const taskConfig: CompositeTaskConfig = {
        type: 'composite',
        videoElement: job.config.videoElement,
        extractionConfig: {
          startTime: segment.startTime,
          endTime: segment.endTime,
          frameRate: segment.extractionConfig.frameRate ?? 30,
          quality: segment.extractionConfig.quality ?? 'medium',
          ...segment.extractionConfig
        },
        encodingConfig: {
          settings: {
            startTime: segment.startTime,
            endTime: segment.endTime,
            frameRate: 30,
            resolution: '640x480',
            quality: 'medium',
            speed: 1.0,
            brightness: 0,
            contrast: 0,
            ...job.config.globalEncodingOptions?.settings,
            ...segment.encodingConfig?.settings
          },
          ...job.config.globalEncodingOptions,
          ...segment.encodingConfig
        }
      };

      // Queue segment task
      const taskId = await this.taskManager.queueTask(taskConfig, {
        priority: segment.priority ?? job.config.priority ?? 0,
        segmentId: segment.id,
        jobId: job.id
      });

      job.segmentTasks.set(segment.id, taskId);
      job.progress.currentlyProcessing.push(segment.id);

      // Listen for task completion
      const unsubscribe = this.taskManager.addEventListener(taskId, (task, event) => {
        if (event.type === 'completed') {
          this.handleSegmentComplete(job, segment, task, startTime);
        } else if (event.type === 'failed') {
          this.handleSegmentError(job, segment, event.error);
        }
      });

      // Wait for task completion
      return new Promise((resolve, reject) => {
        const checkTask = () => {
          const task = this.taskManager.getTask(taskId);
          if (!task) {
            reject(new Error('Task not found'));
            return;
          }

          if (task.status === 'completed') {
            unsubscribe();
            resolve();
          } else if (task.status === 'failed' || task.status === 'cancelled') {
            unsubscribe();
            reject(task.error || new Error('Task cancelled'));
          } else {
            setTimeout(checkTask, 100);
          }
        };

        checkTask();
      });

    } catch (error) {
      this.handleSegmentError(job, segment, error as Error);
      throw error;
    }
  }

  /**
   * Handle successful segment completion
   */
  private handleSegmentComplete(
    job: BatchJob,
    segment: BatchSegment,
    task: ProcessingTask,
    startTime: number
  ): void {
    const processingTime = Date.now() - startTime;
    this.segmentTimingHistory.push(processingTime);

    // Keep history limited
    if (this.segmentTimingHistory.length > 20) {
      this.segmentTimingHistory.shift();
    }

    if (task.result && 'gif' in task.result) {
      const result: BatchSegmentResult = {
        segmentId: segment.id,
        taskId: task.id,
        gif: task.result.gif.blob,
        metadata: {
          width: task.result.gif.metadata.width,
          height: task.result.gif.metadata.height,
          duration: segment.endTime - segment.startTime,
          frameCount: task.result.frames.frames.length,
          fileSize: task.result.gif.blob.size,
          processingTime
        }
      };

      job.results.set(segment.id, result);
      this.options.onSegmentComplete(result);
    }

    // Update progress
    job.progress.completedSegments++;
    job.progress.currentlyProcessing = job.progress.currentlyProcessing.filter(
      id => id !== segment.id
    );
    job.progress.percentage = (job.progress.completedSegments / job.progress.totalSegments) * 100;
    job.progress.averageSegmentTime = this.calculateAverageSegmentTime();
    job.progress.estimatedTimeRemaining = this.calculateETA(job);

    this.options.onJobProgress(job.id, job.progress);
  }

  /**
   * Handle segment error
   */
  private handleSegmentError(job: BatchJob, segment: BatchSegment, error: Error): void {
    job.errors.set(segment.id, error);
    job.progress.currentlyProcessing = job.progress.currentlyProcessing.filter(
      id => id !== segment.id
    );

    this.options.onSegmentError(segment.id, error);
    this.options.onJobProgress(job.id, job.progress);
  }

  /**
   * Complete a batch job
   */
  private completeJob(job: BatchJob): void {
    job.status = 'completed';
    job.completedAt = Date.now();

    const batchResult: BatchJobResult = {
      jobId: job.id,
      status: 'completed',
      isPartial: job.errors.size > 0,
      results: job.results,
      errors: job.errors,
      totalProcessingTime: job.completedAt - (job.startedAt ?? job.createdAt),
      completedSegments: job.results.size,
      failedSegments: job.errors.size,
      totalSegments: job.config.segments.length
    };

    // Store result for potential retrieval
    console.log('Batch job completed:', batchResult);

    // Cleanup after delay
    setTimeout(() => {
      this.activeJobs.delete(job.id);
    }, 60000);
  }

  /**
   * Mark job as failed
   */
  private failJob(job: BatchJob, error: Error): void {
    job.status = 'failed';
    job.completedAt = Date.now();
    job.errors.set('job', error);
  }

  /**
   * Check if more segments can be processed
   */
  private async canProcessMoreSegments(): Promise<boolean> {
    const memoryMetrics = await this.progressTracker.getMemoryMetrics();
    return memoryMetrics.percentage < this.options.memoryThreshold;
  }

  /**
   * Wait for resource availability
   */
  private async waitForResourceAvailability(): Promise<void> {
    return new Promise(resolve => {
      const checkResources = async () => {
        if (await this.canProcessMoreSegments()) {
          resolve();
        } else {
          setTimeout(checkResources, this.options.resourceCheckInterval);
        }
      };
      checkResources();
    });
  }

  /**
   * Calculate average segment processing time
   */
  private calculateAverageSegmentTime(): number {
    if (this.segmentTimingHistory.length === 0) return 0;
    return this.segmentTimingHistory.reduce((sum, time) => sum + time, 0) / this.segmentTimingHistory.length;
  }

  /**
   * Calculate estimated time remaining for job
   */
  private calculateETA(job: BatchJob): number | undefined {
    const averageTime = this.calculateAverageSegmentTime();
    if (averageTime === 0) return undefined;

    const remainingSegments = job.progress.totalSegments - job.progress.completedSegments;
    const concurrentFactor = Math.min(remainingSegments, this.options.maxConcurrentSegments);
    
    return (remainingSegments * averageTime) / concurrentFactor;
  }

  /**
   * Start resource monitoring
   */
  private startResourceMonitoring(): void {
    if (this.resourceCheckInterval) return;

    this.resourceCheckInterval = window.setInterval(async () => {
      const memoryMetrics = await this.progressTracker.getMemoryMetrics();
      
      if (memoryMetrics.percentage > 90) {
        console.warn(`High memory usage (${memoryMetrics.percentage.toFixed(1)}%) detected in batch processor`);
      }
    }, this.options.resourceCheckInterval);
  }

  /**
   * Stop resource monitoring
   */
  stopResourceMonitoring(): void {
    if (this.resourceCheckInterval) {
      clearInterval(this.resourceCheckInterval);
      this.resourceCheckInterval = null;
    }
  }

  /**
   * Get processing statistics
   */
  getStatistics(): {
    totalJobs: number;
    activeJobs: number;
    completedJobs: number;
    failedJobs: number;
    queuedJobs: number;
    averageSegmentTime: number;
    totalSegmentsProcessed: number;
  } {
    const jobs = Array.from(this.activeJobs.values());
    
    return {
      totalJobs: this.activeJobs.size,
      activeJobs: jobs.filter(j => j.status === 'processing').length,
      completedJobs: jobs.filter(j => j.status === 'completed').length,
      failedJobs: jobs.filter(j => j.status === 'failed').length,
      queuedJobs: this.jobQueue.length,
      averageSegmentTime: this.calculateAverageSegmentTime(),
      totalSegmentsProcessed: jobs.reduce((sum, job) => sum + job.results.size, 0)
    };
  }

  /**
   * Cleanup all resources
   */
  destroy(): void {
    this.stopResourceMonitoring();
    
    // Cancel all active jobs
    for (const job of this.activeJobs.values()) {
      if (job.status === 'processing' || job.status === 'queued') {
        this.cancelJob(job.id);
      }
    }

    this.activeJobs.clear();
    this.jobQueue = [];
    this.segmentTimingHistory = [];
  }
}