// Background worker for video processing with WebCodecs API
import { ExtractFramesRequest, EncodeGifRequest } from '@/types';
import { logger } from '@/lib/logger';
import { errorHandler, createError } from '@/lib/errors';
import {
  extractVideoFramesInServiceWorker,
  createServiceWorkerProcessorOptions
} from '@/lib/service-worker-video-processor';

// GIF encoding is NOT supported in service worker context
// All GIF encoding must happen in content script where DOM APIs are available
// This worker only handles frame extraction

export interface VideoProcessingJob {
  id: string;
  type: 'extract_frames' | 'encode_gif';
  data: Record<string, unknown>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

export class BackgroundVideoWorker {
  private static instance: BackgroundVideoWorker;
  private jobs: Map<string, VideoProcessingJob> = new Map();
  private isProcessing = false;
  private processingQueue: string[] = [];

  private constructor() {
    this.initializeWebCodecs();
  }

  public static getInstance(): BackgroundVideoWorker {
    if (!BackgroundVideoWorker.instance) {
      BackgroundVideoWorker.instance = new BackgroundVideoWorker();
    }
    return BackgroundVideoWorker.instance;
  }

  private async initializeWebCodecs(): Promise<void> {
    try {
      const hasWebCodecs = 'VideoDecoder' in globalThis;
      
      if (hasWebCodecs) {
        logger.info('[BackgroundWorker] WebCodecs API initialized successfully', {
          hasVideoDecoder: 'VideoDecoder' in globalThis,
          hasVideoEncoder: 'VideoEncoder' in globalThis,
          hasVideoFrame: 'VideoFrame' in globalThis,
          hasImageDecoder: 'ImageDecoder' in globalThis
        });
      } else {
        logger.warn('[BackgroundWorker] WebCodecs API not available, using fallback processing', {
          environment: 'service-worker',
          fallbackMode: true
        });
      }
    } catch (error) {
      logger.error('[BackgroundWorker] Failed to initialize WebCodecs', { error });
      // Don't throw - allow fallback processing
      logger.warn('[BackgroundWorker] Continuing with fallback video processing');
    }
  }

  // Add a new video processing job to the queue
  public addFrameExtractionJob(request: ExtractFramesRequest): string {
    const jobId = this.generateJobId();
    
    const job: VideoProcessingJob = {
      id: jobId,
      type: 'extract_frames',
      data: request.data,
      status: 'pending',
      progress: 0,
      createdAt: new Date()
    };

    this.jobs.set(jobId, job);
    this.processingQueue.push(jobId);

    logger.info('[BackgroundWorker] Frame extraction job added', { jobId, queueLength: this.processingQueue.length });

    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }

    return jobId;
  }

  public addGifEncodingJob(request: EncodeGifRequest): string {
    // GIF encoding is not supported in service worker context
    // Service workers lack DOM APIs required by GIF encoders
    // All GIF encoding must happen in content script context
    logger.error('[BackgroundWorker] GIF encoding not supported in service worker', {
      request: request.type
    });
    throw createError('gif', 'GIF encoding must be performed in content script context, not in service worker');
  }

  // Get job status and progress
  public getJobStatus(jobId: string): VideoProcessingJob | null {
    return this.jobs.get(jobId) || null;
  }

  // Process the job queue
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    logger.info('[BackgroundWorker] Starting queue processing', { queueLength: this.processingQueue.length });

    try {
      while (this.processingQueue.length > 0) {
        const jobId = this.processingQueue.shift()!;
        const job = this.jobs.get(jobId);

        if (!job) {
          logger.warn('[BackgroundWorker] Job not found', { jobId });
          continue;
        }

        try {
          job.status = 'processing';
          logger.info('[BackgroundWorker] Processing job', { jobId, type: job.type });

          if (job.type === 'extract_frames') {
            await this.processFrameExtractionJob(job);
          } else if (job.type === 'encode_gif') {
            throw createError('gif', 'GIF encoding is not supported in service worker context');
          }

          job.status = 'completed';
          job.completedAt = new Date();
          job.progress = 100;

          logger.info('[BackgroundWorker] Job completed successfully', {
            jobId,
            processingTime: job.completedAt.getTime() - job.createdAt.getTime()
          });

        } catch (error) {
          job.status = 'failed';
          job.error = error instanceof Error ? error.message : 'Unknown error';
          job.completedAt = new Date();

          logger.error('[BackgroundWorker] Job failed', { jobId, error: job.error });
          errorHandler.handleError(error, { jobId, jobType: job.type });
        }
      }
    } finally {
      this.isProcessing = false;
      logger.info('[BackgroundWorker] Queue processing completed');
    }
  }

  // Process frame extraction using WebCodecs and service worker video processor
  private async processFrameExtractionJob(job: VideoProcessingJob): Promise<void> {
    const jobData = job.data as { videoElement: Record<string, unknown>; settings: Record<string, unknown>; tabId?: number };
    const { videoElement, settings, tabId } = jobData;

    logger.info('[BackgroundWorker] Starting advanced frame extraction', {
      settings,
      videoData: {
        width: videoElement.videoWidth,
        height: videoElement.videoHeight,
        duration: videoElement.duration
      },
      tabId
    });

    try {
      // Convert message data to processor options
      const processorOptions = createServiceWorkerProcessorOptions({
        videoElement: videoElement as { currentTime: number; duration: number; videoWidth: number; videoHeight: number },
        settings: settings as { startTime: number; endTime: number; frameRate: number; quality: 'low' | 'medium' | 'high' }
      });

      // Set up progress tracking
      const onProgress = (progress: { progress: number; message: string; stage: string }) => {
        job.progress = progress.progress;
        logger.debug('[BackgroundWorker] Frame extraction progress', { 
          jobId: job.id, 
          progress: progress.progress, 
          message: progress.message 
        });
      };

      // Extract frames using the advanced processor
      const result = await extractVideoFramesInServiceWorker(
        processorOptions, 
        tabId ? Number(tabId) : undefined,
        onProgress
      );

      // Store the extracted frames and metadata
      job.data.extractedFrames = result.frames;
      job.data.extractionMetadata = result.metadata;
      
      logger.info('[BackgroundWorker] Advanced frame extraction completed', {
        framesExtracted: result.frames.length,
        method: result.metadata.extractionMethod,
        processingTime: result.metadata.processingTime,
        dimensions: result.metadata.dimensions,
        actualFrameRate: result.metadata.actualFrameRate
      });

    } catch (error) {
      logger.error('[BackgroundWorker] Advanced frame extraction failed', { error });
      throw createError('video', `Frame extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        processorOptions: jobData,
        jobId: job.id
      });
    }
  }

  // GIF encoding is NOT supported in service worker context
  // This method exists only for type compatibility but will always throw an error
  // All GIF encoding must happen in content script where DOM APIs are available
  private async processGifEncodingJob(job: VideoProcessingJob): Promise<void> {
    logger.error('[BackgroundWorker] GIF encoding called in service worker context', {
      jobId: job.id
    });
    throw createError('gif', 'GIF encoding is not supported in service worker context. Encoding must be performed in content script.');
  }

  // Utility methods
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Clean up completed jobs older than specified time
  public cleanupOldJobs(maxAge: number = 300000): number { // 5 minutes default
    const cutoff = new Date(Date.now() - maxAge);
    let cleanedCount = 0;

    for (const [jobId, job] of this.jobs.entries()) {
      if (job.completedAt && job.completedAt < cutoff) {
        this.jobs.delete(jobId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('[BackgroundWorker] Cleaned up old jobs', { cleanedCount, remainingJobs: this.jobs.size });
    }

    return cleanedCount;
  }

  // Get queue status
  public getQueueStatus() {
    return {
      isProcessing: this.isProcessing,
      queueLength: this.processingQueue.length,
      totalJobs: this.jobs.size,
      jobsByStatus: {
        pending: Array.from(this.jobs.values()).filter(j => j.status === 'pending').length,
        processing: Array.from(this.jobs.values()).filter(j => j.status === 'processing').length,
        completed: Array.from(this.jobs.values()).filter(j => j.status === 'completed').length,
        failed: Array.from(this.jobs.values()).filter(j => j.status === 'failed').length,
      }
    };
  }
}

// Export singleton instance
export const backgroundWorker = BackgroundVideoWorker.getInstance();