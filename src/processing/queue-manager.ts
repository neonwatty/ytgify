/**
 * Queue management system for batch processing operations
 * Handles priority queuing, resource allocation, and job scheduling
 */

import { BatchProcessor, BatchJobConfig } from './batch-processor';
import { TaskManager } from './task-manager';
import { ProgressTracker } from './progress-tracker';

export interface QueuedJob {
  id: string;
  config: BatchJobConfig;
  priority: number;
  estimatedDuration: number;
  resourceRequirements: ResourceRequirements;
  dependencies?: string[]; // Job IDs that must complete first
  scheduledStartTime?: number;
  createdAt: number;
  metadata?: Record<string, unknown>;
}

export interface ResourceRequirements {
  estimatedMemoryMB: number;
  estimatedProcessingTime: number;
  concurrentSegments: number;
  videoComplexity: 'low' | 'medium' | 'high';
}

export interface QueueManagerOptions {
  maxConcurrentJobs?: number;
  maxQueueSize?: number;
  priorityLevels?: number;
  resourceReservationTime?: number;
  jobTimeoutMs?: number;
  enableSmartScheduling?: boolean;
  enableResourceForecasting?: boolean;
  autoOptimization?: boolean;
}

export interface QueueStatistics {
  totalJobs: number;
  queuedJobs: number;
  processingJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageWaitTime: number;
  averageProcessingTime: number;
  queueThroughput: number; // jobs per minute
  resourceUtilization: number;
  estimatedQueueTime: number;
}

export interface SchedulingDecision {
  canSchedule: boolean;
  estimatedStartTime: number;
  reason?: string;
  recommendedPriority?: number;
  resourceConflicts?: string[];
}

export class QueueManager {
  private batchProcessor: BatchProcessor;
  private taskManager: TaskManager;
  private progressTracker: ProgressTracker;
  private jobQueue: QueuedJob[] = [];
  private processingJobs = new Map<string, QueuedJob>();
  private completedJobs: QueuedJob[] = [];
  private failedJobs: QueuedJob[] = [];
  private readonly options: Required<QueueManagerOptions>;
  private schedulingInterval: number | null = null;
  private jobTimings = new Map<string, { startTime: number; duration?: number }>();
  private resourceUsageHistory: Array<{ timestamp: number; memoryUsage: number; activeJobs: number }> = [];

  constructor(
    batchProcessor: BatchProcessor,
    taskManager: TaskManager,
    progressTracker: ProgressTracker,
    options: QueueManagerOptions = {}
  ) {
    this.batchProcessor = batchProcessor;
    this.taskManager = taskManager;
    this.progressTracker = progressTracker;

    this.options = {
      maxConcurrentJobs: options.maxConcurrentJobs ?? 2,
      maxQueueSize: options.maxQueueSize ?? 50,
      priorityLevels: options.priorityLevels ?? 5,
      resourceReservationTime: options.resourceReservationTime ?? 300000, // 5 minutes
      jobTimeoutMs: options.jobTimeoutMs ?? 1800000, // 30 minutes
      enableSmartScheduling: options.enableSmartScheduling ?? true,
      enableResourceForecasting: options.enableResourceForecasting ?? true,
      autoOptimization: options.autoOptimization ?? true
    };

    if (this.options.enableSmartScheduling) {
      this.startSmartScheduling();
    }
  }

  /**
   * Submit a job to the queue
   */
  async submitJob(
    config: BatchJobConfig,
    options: {
      priority?: number;
      dependencies?: string[];
      scheduledStartTime?: number;
      resourceHint?: Partial<ResourceRequirements>;
    } = {}
  ): Promise<string> {
    if (this.jobQueue.length >= this.options.maxQueueSize) {
      throw new Error('Queue is full');
    }

    const resourceRequirements = await this.estimateResourceRequirements(config, options.resourceHint);
    const estimatedDuration = this.estimateJobDuration(config, resourceRequirements);

    const queuedJob: QueuedJob = {
      id: config.id,
      config,
      priority: this.normalizePriority(options.priority ?? 0),
      estimatedDuration,
      resourceRequirements,
      dependencies: options.dependencies,
      scheduledStartTime: options.scheduledStartTime,
      createdAt: Date.now()
    };

    // Insert job in priority order
    this.insertJobByPriority(queuedJob);

    // Try to schedule immediately if smart scheduling is disabled
    if (!this.options.enableSmartScheduling) {
      await this.processQueue();
    }

    return config.id;
  }

  /**
   * Remove a job from the queue or cancel if processing
   */
  async cancelJob(jobId: string): Promise<boolean> {
    // Check if job is in queue
    const queueIndex = this.jobQueue.findIndex(job => job.id === jobId);
    if (queueIndex !== -1) {
      this.jobQueue.splice(queueIndex, 1);
      return true;
    }

    // Check if job is processing
    if (this.processingJobs.has(jobId)) {
      const success = this.batchProcessor.cancelJob(jobId);
      if (success) {
        this.processingJobs.delete(jobId);
      }
      return success;
    }

    return false;
  }

  /**
   * Get job position in queue
   */
  getJobPosition(jobId: string): number {
    return this.jobQueue.findIndex(job => job.id === jobId);
  }

  /**
   * Get queue statistics
   */
  getStatistics(): QueueStatistics {
    const completedJobTimes = Array.from(this.jobTimings.values())
      .filter(timing => timing.duration !== undefined)
      .map(timing => timing.duration!);

    const averageProcessingTime = completedJobTimes.length > 0
      ? completedJobTimes.reduce((sum, time) => sum + time, 0) / completedJobTimes.length
      : 0;

    const recentCompletions = this.completedJobs.filter(
      job => Date.now() - job.createdAt < 3600000 // Last hour
    );

    return {
      totalJobs: this.jobQueue.length + this.processingJobs.size + this.completedJobs.length + this.failedJobs.length,
      queuedJobs: this.jobQueue.length,
      processingJobs: this.processingJobs.size,
      completedJobs: this.completedJobs.length,
      failedJobs: this.failedJobs.length,
      averageWaitTime: this.calculateAverageWaitTime(),
      averageProcessingTime,
      queueThroughput: (recentCompletions.length / 60), // per minute
      resourceUtilization: this.calculateResourceUtilization(),
      estimatedQueueTime: this.estimateQueueTime()
    };
  }

  /**
   * Get scheduling recommendation for a potential job
   */
  async getSchedulingDecision(
    config: BatchJobConfig,
    priority: number = 0
  ): Promise<SchedulingDecision> {
    const resourceRequirements = await this.estimateResourceRequirements(config);
    const normalizedPriority = this.normalizePriority(priority);

    // Check resource availability
    const canScheduleNow = await this.canScheduleJob(resourceRequirements);
    
    if (canScheduleNow && this.processingJobs.size < this.options.maxConcurrentJobs) {
      return {
        canSchedule: true,
        estimatedStartTime: Date.now()
      };
    }

    // Calculate estimated start time based on queue
    const estimatedStartTime = this.calculateEstimatedStartTime(normalizedPriority, resourceRequirements);
    
    const decision: SchedulingDecision = {
      canSchedule: true,
      estimatedStartTime
    };

    // Check for resource conflicts
    const conflicts = this.checkResourceConflicts(resourceRequirements);
    if (conflicts.length > 0) {
      decision.resourceConflicts = conflicts;
      decision.reason = 'Resource conflicts detected';
    }

    // Recommend priority adjustment if queue is congested
    if (this.jobQueue.length > this.options.maxQueueSize * 0.8) {
      decision.recommendedPriority = Math.min(normalizedPriority + 1, this.options.priorityLevels);
      decision.reason = 'Queue congested - consider higher priority';
    }

    return decision;
  }

  /**
   * Update job priority (only for queued jobs)
   */
  updateJobPriority(jobId: string, newPriority: number): boolean {
    const jobIndex = this.jobQueue.findIndex(job => job.id === jobId);
    if (jobIndex === -1) return false;

    const job = this.jobQueue.splice(jobIndex, 1)[0];
    job.priority = this.normalizePriority(newPriority);
    this.insertJobByPriority(job);

    return true;
  }

  /**
   * Get detailed queue information
   */
  getQueueDetails(): {
    queue: QueuedJob[];
    processing: QueuedJob[];
    estimated: Array<{ jobId: string; estimatedStartTime: number; estimatedEndTime: number }>;
  } {
    const estimated = this.jobQueue.map(job => ({
      jobId: job.id,
      estimatedStartTime: this.calculateEstimatedStartTime(job.priority, job.resourceRequirements),
      estimatedEndTime: this.calculateEstimatedStartTime(job.priority, job.resourceRequirements) + job.estimatedDuration
    }));

    return {
      queue: [...this.jobQueue],
      processing: Array.from(this.processingJobs.values()),
      estimated
    };
  }

  /**
   * Process the queue and start eligible jobs
   */
  private async processQueue(): Promise<void> {
    while (
      this.processingJobs.size < this.options.maxConcurrentJobs &&
      this.jobQueue.length > 0
    ) {
      const job = this.getNextEligibleJob();
      if (!job) break;

      // Check resource availability
      if (!await this.canScheduleJob(job.resourceRequirements)) {
        break;
      }

      // Remove from queue and start processing
      const queueIndex = this.jobQueue.indexOf(job);
      this.jobQueue.splice(queueIndex, 1);
      
      await this.startJob(job);
    }
  }

  /**
   * Get the next eligible job considering dependencies and scheduling
   */
  private getNextEligibleJob(): QueuedJob | null {
    const now = Date.now();

    for (const job of this.jobQueue) {
      // Check scheduled start time
      if (job.scheduledStartTime && job.scheduledStartTime > now) {
        continue;
      }

      // Check dependencies
      if (job.dependencies && !this.areDependenciesSatisfied(job.dependencies)) {
        continue;
      }

      return job;
    }

    return null;
  }

  /**
   * Check if job dependencies are satisfied
   */
  private areDependenciesSatisfied(dependencies: string[]): boolean {
    for (const depId of dependencies) {
      // Check if dependency is completed
      const isCompleted = this.completedJobs.some(job => job.id === depId);
      if (!isCompleted) {
        return false;
      }
    }
    return true;
  }

  /**
   * Start processing a job
   */
  private async startJob(job: QueuedJob): Promise<void> {
    this.processingJobs.set(job.id, job);
    this.jobTimings.set(job.id, { startTime: Date.now() });

    try {
      await this.batchProcessor.submitJob(job.config);
      
      // Monitor job completion
      this.monitorJob(job);

    } catch (error) {
      this.handleJobError(job, error as Error);
    }
  }

  /**
   * Monitor a job for completion
   */
  private monitorJob(job: QueuedJob): void {
    const checkInterval = setInterval(() => {
      const batchJob = this.batchProcessor.getJob(job.id);
      
      if (!batchJob) {
        clearInterval(checkInterval);
        this.handleJobError(job, new Error('Job not found in batch processor'));
        return;
      }

      if (batchJob.status === 'completed') {
        clearInterval(checkInterval);
        this.handleJobComplete(job);
      } else if (batchJob.status === 'failed') {
        clearInterval(checkInterval);
        this.handleJobError(job, new Error('Batch processing failed'));
      }
    }, 1000);

    // Set timeout
    setTimeout(() => {
      clearInterval(checkInterval);
      if (this.processingJobs.has(job.id)) {
        this.batchProcessor.cancelJob(job.id);
        this.handleJobError(job, new Error('Job timeout'));
      }
    }, this.options.jobTimeoutMs);
  }

  /**
   * Handle job completion
   */
  private handleJobComplete(job: QueuedJob): void {
    this.processingJobs.delete(job.id);
    this.completedJobs.push(job);

    const timing = this.jobTimings.get(job.id);
    if (timing) {
      timing.duration = Date.now() - timing.startTime;
    }

    // Continue processing queue
    this.processQueue();
  }

  /**
   * Handle job error
   */
  private handleJobError(job: QueuedJob, error: Error): void {
    this.processingJobs.delete(job.id);
    this.failedJobs.push(job);

    console.error(`Queue manager: Job ${job.id} failed:`, error);

    // Continue processing queue
    this.processQueue();
  }

  /**
   * Insert job in queue maintaining priority order
   */
  private insertJobByPriority(job: QueuedJob): void {
    let insertIndex = 0;
    
    for (let i = 0; i < this.jobQueue.length; i++) {
      if (this.jobQueue[i].priority < job.priority) {
        insertIndex = i;
        break;
      }
      insertIndex = i + 1;
    }
    
    this.jobQueue.splice(insertIndex, 0, job);
  }

  /**
   * Normalize priority to valid range
   */
  private normalizePriority(priority: number): number {
    return Math.max(0, Math.min(priority, this.options.priorityLevels));
  }

  /**
   * Estimate resource requirements for a job
   */
  private async estimateResourceRequirements(
    config: BatchJobConfig,
    hint?: Partial<ResourceRequirements>
  ): Promise<ResourceRequirements> {
    const segmentCount = config.segments.length;
    const averageSegmentDuration = config.segments.reduce(
      (sum, segment) => sum + (segment.endTime - segment.startTime), 0
    ) / segmentCount;

    // Estimate based on segment count and duration
    const baseMemoryMB = 50; // Base memory per segment
    const memoryPerSecond = 10; // Additional memory per second of video
    
    const estimatedMemoryMB = segmentCount * (baseMemoryMB + averageSegmentDuration * memoryPerSecond);
    const estimatedProcessingTime = segmentCount * averageSegmentDuration * 2; // 2x realtime estimate

    const complexity: 'low' | 'medium' | 'high' = 
      averageSegmentDuration > 30 ? 'high' :
      averageSegmentDuration > 10 ? 'medium' : 'low';

    return {
      estimatedMemoryMB: hint?.estimatedMemoryMB ?? estimatedMemoryMB,
      estimatedProcessingTime: hint?.estimatedProcessingTime ?? estimatedProcessingTime,
      concurrentSegments: hint?.concurrentSegments ?? Math.min(segmentCount, 3),
      videoComplexity: hint?.videoComplexity ?? complexity
    };
  }

  /**
   * Estimate job duration
   */
  private estimateJobDuration(config: BatchJobConfig, requirements: ResourceRequirements): number {
    const baseTime = requirements.estimatedProcessingTime;
    const complexityMultiplier = {
      low: 1.0,
      medium: 1.5,
      high: 2.0
    }[requirements.videoComplexity];

    return baseTime * complexityMultiplier;
  }

  /**
   * Check if a job can be scheduled based on resources
   */
  private async canScheduleJob(_requirements: ResourceRequirements): Promise<boolean> {
    const memoryMetrics = await this.progressTracker.getMemoryMetrics();
    const availableMemoryMB = ((memoryMetrics.limit - memoryMetrics.used) / 1024 / 1024);
    
    return availableMemoryMB > _requirements.estimatedMemoryMB;
  }

  /**
   * Calculate estimated start time for a job
   */
  private calculateEstimatedStartTime(priority: number, _requirements: ResourceRequirements): number {
    let estimatedTime = Date.now();
    
    // Add time for higher priority jobs ahead in queue
    for (const job of this.jobQueue) {
      if (job.priority >= priority) {
        estimatedTime += job.estimatedDuration;
      }
    }

    // Add time for currently processing jobs
    for (const job of this.processingJobs.values()) {
      estimatedTime += Math.max(0, job.estimatedDuration - 
        (Date.now() - (this.jobTimings.get(job.id)?.startTime ?? Date.now())));
    }

    return estimatedTime;
  }

  /**
   * Check for resource conflicts
   */
  private checkResourceConflicts(_requirements: ResourceRequirements): string[] {
    const conflicts: string[] = [];
    
    // Check memory conflicts with processing jobs
    let totalMemoryRequired = _requirements.estimatedMemoryMB;
    for (const job of this.processingJobs.values()) {
      totalMemoryRequired += job.resourceRequirements.estimatedMemoryMB;
    }
    
    if (totalMemoryRequired > 1000) { // Arbitrary threshold
      conflicts.push('High memory usage predicted');
    }

    return conflicts;
  }

  /**
   * Calculate average wait time
   */
  private calculateAverageWaitTime(): number {
    const completedWithTimings = Array.from(this.jobTimings.entries())
      .filter(([jobId]) => this.completedJobs.some(job => job.id === jobId))
      .map(([jobId, timing]) => {
        const job = this.completedJobs.find(j => j.id === jobId)!;
        return timing.startTime - job.createdAt;
      });

    return completedWithTimings.length > 0
      ? completedWithTimings.reduce((sum, time) => sum + time, 0) / completedWithTimings.length
      : 0;
  }

  /**
   * Calculate resource utilization
   */
  private calculateResourceUtilization(): number {
    if (this.resourceUsageHistory.length === 0) return 0;
    
    const recent = this.resourceUsageHistory.slice(-10);
    const averageUtilization = recent.reduce((sum, entry) => sum + entry.memoryUsage, 0) / recent.length;
    
    return Math.min(100, averageUtilization);
  }

  /**
   * Estimate total queue processing time
   */
  private estimateQueueTime(): number {
    return this.jobQueue.reduce((sum, job) => sum + job.estimatedDuration, 0) / this.options.maxConcurrentJobs;
  }

  /**
   * Start smart scheduling
   */
  private startSmartScheduling(): void {
    this.schedulingInterval = window.setInterval(async () => {
      // Update resource usage history
      const memoryMetrics = await this.progressTracker.getMemoryMetrics();
      this.resourceUsageHistory.push({
        timestamp: Date.now(),
        memoryUsage: memoryMetrics.percentage,
        activeJobs: this.processingJobs.size
      });

      // Keep history limited
      if (this.resourceUsageHistory.length > 100) {
        this.resourceUsageHistory.shift();
      }

      // Process queue
      await this.processQueue();
    }, 5000);
  }

  /**
   * Stop smart scheduling
   */
  stopSmartScheduling(): void {
    if (this.schedulingInterval) {
      clearInterval(this.schedulingInterval);
      this.schedulingInterval = null;
    }
  }

  /**
   * Clear completed jobs older than specified time
   */
  clearOldJobs(maxAge: number = 3600000): number {
    const cutoff = Date.now() - maxAge;
    const initialCount = this.completedJobs.length + this.failedJobs.length;

    this.completedJobs = this.completedJobs.filter(job => job.createdAt > cutoff);
    this.failedJobs = this.failedJobs.filter(job => job.createdAt > cutoff);

    const finalCount = this.completedJobs.length + this.failedJobs.length;
    return initialCount - finalCount;
  }

  /**
   * Cleanup all resources
   */
  destroy(): void {
    this.stopSmartScheduling();
    
    // Cancel all queued jobs
    for (const job of this.jobQueue) {
      this.batchProcessor.cancelJob(job.id);
    }

    // Cancel all processing jobs
    for (const job of this.processingJobs.values()) {
      this.batchProcessor.cancelJob(job.id);
    }

    this.jobQueue = [];
    this.processingJobs.clear();
    this.completedJobs = [];
    this.failedJobs = [];
    this.jobTimings.clear();
    this.resourceUsageHistory = [];
  }
}