// Enhanced message handler for background service worker
import { 
  ExtensionMessage,
  ExtractFramesRequest,
  ExtractFramesResponse,
  EncodeGifRequest,
  EncodeGifResponse,
  GetVideoStateRequest,
  GetVideoStateResponse,
  isExtractFramesRequest,
  isEncodeGifRequest,
  isGetVideoStateRequest,
  isLogMessage
} from '@/types';
import { backgroundWorker, VideoProcessingJob } from './worker';
import { logger } from '@/lib/logger';
import { errorHandler, createError } from '@/lib/errors';

export interface MessageHandlerOptions {
  enableProgressUpdates?: boolean;
  maxConcurrentJobs?: number;
  jobTimeout?: number;
}

export class BackgroundMessageHandler {
  private static instance: BackgroundMessageHandler;
  private options: MessageHandlerOptions;
  private activeJobs: Map<string, { jobId: string; requestId?: string; sender: chrome.runtime.MessageSender }> = new Map();
  private progressUpdateInterval?: NodeJS.Timeout;

  private constructor(options: MessageHandlerOptions = {}) {
    this.options = {
      enableProgressUpdates: true,
      maxConcurrentJobs: 5,
      jobTimeout: 300000, // 5 minutes
      ...options
    };

    this.initializeProgressTracking();
  }

  public static getInstance(options?: MessageHandlerOptions): BackgroundMessageHandler {
    if (!BackgroundMessageHandler.instance) {
      BackgroundMessageHandler.instance = new BackgroundMessageHandler(options);
    }
    return BackgroundMessageHandler.instance;
  }

  // Main message routing handler
  public async handleMessage(
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: ExtensionMessage) => void
  ): Promise<boolean> {
    try {
      logger.info('[MessageHandler] Processing message', { 
        type: message.type, 
        from: sender.tab?.url || 'popup',
        messageId: message.id 
      });

      // Route to specific handlers
      if (isExtractFramesRequest(message)) {
        await this.handleFrameExtraction(message, sender, sendResponse);
        return true; // Async response
      }

      if (isEncodeGifRequest(message)) {
        await this.handleGifEncoding(message, sender, sendResponse);
        return true; // Async response
      }

      if (isGetVideoStateRequest(message)) {
        await this.handleVideoStateQuery(message, sender, sendResponse);
        return true; // Async response
      }

      if (isLogMessage(message)) {
        this.handleLogging(message);
        return false; // No response needed
      }

      // Handle job status queries (temporarily cast until types are fully integrated)
      if ((message as unknown as { type: string }).type === 'GET_JOB_STATUS') {
        this.handleJobStatusQuery(message, sender, sendResponse);
        return true;
      }

      // Handle job cancellation (temporarily cast until types are fully integrated)
      if ((message as unknown as { type: string }).type === 'CANCEL_JOB') {
        this.handleJobCancellation(message, sender, sendResponse);
        return true;
      }

      logger.warn('[MessageHandler] Unknown message type', { type: message.type });
      sendResponse({
        type: 'ERROR_RESPONSE',
        success: false,
        error: `Unknown message type: ${message.type}`
      } as ExtensionMessage);

      return false;

    } catch (error) {
      logger.error('[MessageHandler] Message handling failed', { 
        error, 
        messageType: message.type,
        messageId: message.id 
      });

      errorHandler.handleError(error, {
        messageType: message.type,
        senderId: sender.tab?.id,
        senderUrl: sender.tab?.url
      });

      sendResponse({
        type: 'ERROR_RESPONSE',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      } as ExtensionMessage);

      return false;
    }
  }

  // Handle frame extraction requests
  private async handleFrameExtraction(
    message: ExtractFramesRequest,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: ExtractFramesResponse) => void
  ): Promise<void> {
    try {
      logger.info('[MessageHandler] Starting frame extraction', { 
        settings: message.data.settings,
        videoData: {
          width: message.data.videoElement.videoWidth,
          height: message.data.videoElement.videoHeight,
          duration: message.data.videoElement.duration
        }
      });

      // Check concurrent job limits
      if (this.activeJobs.size >= (this.options.maxConcurrentJobs || 5)) {
        throw createError('video', 'Too many concurrent jobs. Please wait for current jobs to complete.');
      }

      // Add job to worker with sender tab information
      const enrichedMessage = {
        ...message,
        data: {
          ...message.data,
          tabId: sender.tab?.id
        }
      };
      const jobId = backgroundWorker.addFrameExtractionJob(enrichedMessage as ExtractFramesRequest);
      
      // Track the job
      this.activeJobs.set(jobId, {
        jobId,
        requestId: message.id,
        sender
      });

      // Set up job completion monitoring
      this.monitorJobCompletion(jobId, (job) => {
        try {
          if (job.status === 'completed') {
            const jobData = job.data as { extractedFrames?: ImageData[] };
            const response: ExtractFramesResponse = {
              type: 'EXTRACT_FRAMES_RESPONSE',
              id: message.id,
              success: true,
              data: {
                frames: jobData.extractedFrames || [],
                frameCount: jobData.extractedFrames?.length || 0
              }
            };

            sendResponse(response);
            logger.info('[MessageHandler] Frame extraction completed successfully', { 
              jobId, 
              frameCount: response.data?.frameCount 
            });

          } else if (job.status === 'failed') {
            const response: ExtractFramesResponse = {
              type: 'EXTRACT_FRAMES_RESPONSE',
              id: message.id,
              success: false,
              error: job.error || 'Frame extraction failed'
            };

            sendResponse(response);
            logger.error('[MessageHandler] Frame extraction failed', { jobId, error: job.error });
          }
        } finally {
          this.activeJobs.delete(jobId);
        }
      });

    } catch (error) {
      logger.error('[MessageHandler] Frame extraction setup failed', { error });
      
      const response: ExtractFramesResponse = {
        type: 'EXTRACT_FRAMES_RESPONSE',
        id: message.id,
        success: false,
        error: error instanceof Error ? error.message : 'Frame extraction failed'
      };

      sendResponse(response);
    }
  }

  // Handle GIF encoding requests
  private async handleGifEncoding(
    message: EncodeGifRequest,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: EncodeGifResponse) => void
  ): Promise<void> {
    try {
      logger.info('[MessageHandler] Starting GIF encoding', { 
        frameCount: message.data.frames.length,
        settings: message.data.settings,
        metadata: message.data.metadata
      });

      if (this.activeJobs.size >= (this.options.maxConcurrentJobs || 5)) {
        throw createError('gif', 'Too many concurrent jobs. Please wait for current jobs to complete.');
      }

      const jobId = backgroundWorker.addGifEncodingJob(message);
      
      this.activeJobs.set(jobId, {
        jobId,
        requestId: message.id,
        sender
      });

      this.monitorJobCompletion(jobId, (job) => {
        try {
          if (job.status === 'completed') {
            const jobData = job.data as { encodedGif: { gifBlob: Blob; thumbnailBlob: Blob; metadata: Record<string, unknown> } };
            const encodedData = jobData.encodedGif;
            const response: EncodeGifResponse = {
              type: 'ENCODE_GIF_RESPONSE',
              id: message.id,
              success: true,
              data: {
                gifBlob: encodedData.gifBlob,
                thumbnailBlob: encodedData.thumbnailBlob,
                metadata: encodedData.metadata as {
                  fileSize: number;
                  duration: number;
                  width: number;
                  height: number;
                }
              }
            };

            sendResponse(response);
            logger.info('[MessageHandler] GIF encoding completed successfully', { 
              jobId, 
              fileSize: encodedData.metadata.fileSize 
            });

          } else if (job.status === 'failed') {
            const response: EncodeGifResponse = {
              type: 'ENCODE_GIF_RESPONSE',
              id: message.id,
              success: false,
              error: job.error || 'GIF encoding failed'
            };

            sendResponse(response);
            logger.error('[MessageHandler] GIF encoding failed', { jobId, error: job.error });
          }
        } finally {
          this.activeJobs.delete(jobId);
        }
      });

    } catch (error) {
      logger.error('[MessageHandler] GIF encoding setup failed', { error });
      
      const response: EncodeGifResponse = {
        type: 'ENCODE_GIF_RESPONSE',
        id: message.id,
        success: false,
        error: error instanceof Error ? error.message : 'GIF encoding failed'
      };

      sendResponse(response);
    }
  }

  // Handle video state queries
  private async handleVideoStateQuery(
    message: GetVideoStateRequest,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: GetVideoStateResponse) => void
  ): Promise<void> {
    try {
      if (!sender.tab?.id) {
        throw createError('youtube', 'No active tab found for video state query');
      }

      // In a real implementation, this would communicate with the content script
      // to get actual video state. For now, we'll return mock data.
      const response: GetVideoStateResponse = {
        type: 'GET_VIDEO_STATE_RESPONSE',
        id: message.id,
        success: true,
        data: {
          isPlaying: false,
          currentTime: 0,
          duration: 0,
          videoUrl: sender.tab.url || '',
          title: sender.tab.title || 'Unknown Video'
        }
      };

      sendResponse(response);
      logger.debug('[MessageHandler] Video state query completed', { tabId: sender.tab.id });

    } catch (error) {
      logger.error('[MessageHandler] Video state query failed', { error });
      
      const response: GetVideoStateResponse = {
        type: 'GET_VIDEO_STATE_RESPONSE',
        id: message.id,
        success: false,
        error: error instanceof Error ? error.message : 'Video state query failed'
      };

      sendResponse(response);
    }
  }

  // Handle logging messages
  private handleLogging(message: ExtensionMessage & { type: 'LOG' }): void {
    const { level, message: logMessage, context } = message.data;
    
    // Forward to centralized logger
    logger.log(level, logMessage, context, 'background');
  }

  // Handle job status queries
  private handleJobStatusQuery(
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: ExtensionMessage) => void
  ): void {
    try {
      const { jobId } = (message as unknown as { data: { jobId: string } }).data;
      const job = backgroundWorker.getJobStatus(jobId);

      if (!job) {
        sendResponse({
          type: 'JOB_STATUS_RESPONSE',
          success: false,
          error: 'Job not found'
        } as ExtensionMessage);
        return;
      }

      sendResponse({
        type: 'JOB_STATUS_RESPONSE',
        success: true,
        data: {
          jobId: job.id,
          status: job.status,
          progress: job.progress,
          error: job.error,
          createdAt: job.createdAt.toISOString(),
          completedAt: job.completedAt?.toISOString()
        }
      } as ExtensionMessage);

    } catch (error) {
      logger.error('[MessageHandler] Job status query failed', { error });
      sendResponse({
        type: 'JOB_STATUS_RESPONSE',
        success: false,
        error: error instanceof Error ? error.message : 'Status query failed'
      } as ExtensionMessage);
    }
  }

  // Handle job cancellation
  private handleJobCancellation(
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: ExtensionMessage) => void
  ): void {
    try {
      const { jobId } = (message as unknown as { data: { jobId: string } }).data;
      
      // Remove from active jobs tracking
      if (this.activeJobs.has(jobId)) {
        this.activeJobs.delete(jobId);
        logger.info('[MessageHandler] Job cancelled', { jobId });
      }

      sendResponse({
        type: 'JOB_CANCEL_RESPONSE',
        success: true,
        data: { jobId: jobId as string, cancelled: true }
      } as ExtensionMessage);

    } catch (error) {
      logger.error('[MessageHandler] Job cancellation failed', { error });
      sendResponse({
        type: 'JOB_CANCEL_RESPONSE',
        success: false,
        error: error instanceof Error ? error.message : 'Cancellation failed'
      } as ExtensionMessage);
    }
  }

  // Monitor job completion with polling
  private monitorJobCompletion(
    jobId: string, 
    onComplete: (job: VideoProcessingJob) => void,
    timeout: number = this.options.jobTimeout || 300000
  ): void {
    const startTime = Date.now();
    
    const checkStatus = () => {
      const job = backgroundWorker.getJobStatus(jobId);
      
      if (!job) {
        logger.warn('[MessageHandler] Job disappeared during monitoring', { jobId });
        return;
      }

      if (job.status === 'completed' || job.status === 'failed') {
        onComplete(job);
        return;
      }

      // Check for timeout
      if (Date.now() - startTime > timeout) {
        logger.error('[MessageHandler] Job timeout', { jobId, timeout });
        job.status = 'failed';
        job.error = 'Job timeout';
        onComplete(job);
        return;
      }

      // Continue monitoring
      setTimeout(checkStatus, 1000); // Check every second
    };

    setTimeout(checkStatus, 100); // Start checking after 100ms
  }

  // Initialize progress update broadcasting
  private initializeProgressTracking(): void {
    if (!this.options.enableProgressUpdates) {
      return;
    }

    this.progressUpdateInterval = setInterval(() => {
      this.broadcastProgressUpdates();
    }, 2000); // Update every 2 seconds
  }

  // Broadcast progress updates to relevant senders
  private broadcastProgressUpdates(): void {
    for (const [jobId, jobInfo] of this.activeJobs.entries()) {
      const job = backgroundWorker.getJobStatus(jobId);
      
      if (job && job.status === 'processing' && jobInfo.sender.tab?.id) {
        try {
          chrome.tabs.sendMessage(jobInfo.sender.tab.id, {
            type: 'JOB_PROGRESS_UPDATE',
            data: {
              jobId,
              progress: job.progress,
              status: job.status
            }
          });
        } catch (error) {
          // Ignore errors for progress updates
          logger.debug('[MessageHandler] Progress update failed', { jobId, error });
        }
      }
    }
  }

  // Get handler statistics
  public getStatistics() {
    const queueStatus = backgroundWorker.getQueueStatus();
    
    return {
      activeJobs: this.activeJobs.size,
      maxConcurrentJobs: this.options.maxConcurrentJobs,
      workerQueue: queueStatus,
      progressUpdatesEnabled: this.options.enableProgressUpdates
    };
  }

  // Cleanup method
  public cleanup(): void {
    if (this.progressUpdateInterval) {
      clearInterval(this.progressUpdateInterval);
    }
    
    this.activeJobs.clear();
    backgroundWorker.cleanupOldJobs();
    
    logger.info('[MessageHandler] Cleanup completed');
  }
}

// Export singleton instance
export const messageHandler = BackgroundMessageHandler.getInstance();