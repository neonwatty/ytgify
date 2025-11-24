// Enhanced message handler for background service worker
import { 
  ExtensionMessage,
  ExtractFramesRequest,
  ExtractFramesResponse,
  EncodeGifRequest,
  EncodeGifResponse,
  GetVideoStateRequest,
  GetVideoStateResponse,
  TimelineSelectionUpdate,
  RequestVideoDataForGif,
  VideoDataResponse,
  GifCreationComplete,
  SaveGifRequest,
  SaveGifResponse,
  SuccessResponse,
  ErrorResponse,
  DownloadGifRequest,
  GetJobStatusRequest,
  isExtractFramesRequest,
  isEncodeGifRequest,
  isGetVideoStateRequest,
  isTimelineSelectionUpdate,
  isLogMessage,
  isDownloadGifRequest,
  isGetJobStatusRequest
} from '@/types';
import { backgroundWorker, VideoProcessingJob } from './worker';
import { logger } from '@/lib/logger';
import { errorHandler, createError } from '@/lib/errors';

/** @internal */
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
      enableProgressUpdates: typeof process !== 'undefined' && process.env.NODE_ENV !== 'test',
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

  public static resetInstance(): void {
    if (BackgroundMessageHandler.instance) {
      BackgroundMessageHandler.instance.cleanup();
      BackgroundMessageHandler.instance = undefined as unknown as BackgroundMessageHandler;
    }
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

      if (isTimelineSelectionUpdate(message)) {
        // Send immediate response before async processing
        sendResponse({
          type: 'SUCCESS_RESPONSE',
          success: true,
          data: { message: 'GIF creation started' }
        } as SuccessResponse);
        
        // Handle the timeline selection asynchronously  
        this.handleTimelineSelectionUpdate(message, sender);
        return false; // Response already sent
      }

      // Handle GIF storage request
      if (message.type === 'SAVE_GIF_REQUEST') {
        // Use Promise to ensure the port stays open
        (async () => {
          await this.handleSaveGifRequest(message, sender, sendResponse);
        })();
        return true; // Keep port open for async response
      }

      // Handle GIF download request
      if (isDownloadGifRequest(message)) {
        this.handleGifDownload(message, sendResponse);
        return true;
      }

      // Handle job status queries
      if (isGetJobStatusRequest(message)) {
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
      
      // Send initial progress update immediately
      if (sender.tab?.id) {
        chrome.tabs.sendMessage(sender.tab.id, {
          type: 'JOB_PROGRESS_UPDATE',
          data: {
            jobId,
            progress: 0,
            status: 'processing',
            stage: 'initializing',
            message: 'Starting frame extraction...'
          }
        }).catch(() => {});
      }

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
      
      // Send initial progress update immediately
      if (sender.tab?.id) {
        chrome.tabs.sendMessage(sender.tab.id, {
          type: 'JOB_PROGRESS_UPDATE',
          data: {
            jobId,
            progress: 0,
            status: 'processing',
            stage: 'preparing',
            message: 'Starting GIF encoding...'
          }
        }).catch(() => {});
      }

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

  // Handle GIF storage request
  private async handleSaveGifRequest(
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: ExtensionMessage) => void
  ): Promise<void> {
    try {
      logger.info('[MessageHandler] Saving GIF to storage', { 
        from: sender.tab?.url || 'popup'
      });

      // Extract GIF data from message
      const saveRequest = message as SaveGifRequest;
      const { gifData } = saveRequest.data;

      // IndexedDB storage removed - GIF creation complete
      // User downloads directly from overlay popup
      logger.info('[MessageHandler] GIF processing complete', { id: gifData.id });

      const response: SaveGifResponse = {
        type: 'SAVE_GIF_RESPONSE',
        success: true,
        data: { gifId: gifData.id }
      };
      sendResponse(response);
      
    } catch (error) {
      logger.error('[MessageHandler] Failed to save GIF', { error });
      const response: SaveGifResponse = {
        type: 'SAVE_GIF_RESPONSE',
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save GIF'
      };
      sendResponse(response);
    }
  }

  // Helper to convert blob to data URL
  private async blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Handle timeline selection updates - initiate complete GIF creation process
  private handleTimelineSelectionUpdate(
    message: TimelineSelectionUpdate,
    sender: chrome.runtime.MessageSender
  ): void {
    // Wrap in async IIFE to handle async operations
    (async () => {
      try {
      logger.info('[MessageHandler] Starting GIF creation from timeline selection', { 
        selection: message.data,
        from: sender.tab?.url 
      });

      if (!sender.tab?.id) {
        throw createError('youtube', 'No active tab found for GIF creation');
      }

      const { startTime, endTime, duration } = message.data;

      // Validate selection
      if (duration < 0.5) {
        throw createError('gif', 'Selection too short - minimum duration is 0.5 seconds');
      }

      if (duration > 30) {
        throw createError('gif', 'Selection too long - maximum duration is 30 seconds');
      }

      // Send request to content script to extract video data and start frame extraction
      try {
        const videoDataResponse = await new Promise<VideoDataResponse['data']>((resolve, reject) => {
          const request: RequestVideoDataForGif = {
            type: 'REQUEST_VIDEO_DATA_FOR_GIF',
            data: { startTime, endTime, duration }
          };
          
          chrome.tabs.sendMessage(sender.tab!.id!, request, (response: VideoDataResponse) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (response?.error) {
              reject(new Error(response.error));
            } else {
              resolve(response.data);
            }
          });
        });

        // Create frame extraction job
        if (!videoDataResponse) {
          throw createError('youtube', 'No video data received from content script');
        }
        
        const frameExtractionRequest: ExtractFramesRequest = {
          type: 'EXTRACT_FRAMES',
          id: message.id,
          data: {
            videoElement: videoDataResponse.videoElement,
            settings: {
              startTime,
              endTime,
              frameRate: 10, // Default frame rate
              quality: 'medium' as const // Default quality
            }
          }
        };

        // Start frame extraction and chain to GIF encoding (async, no await)
        // Completion will be notified via GIF_CREATION_COMPLETE message
        this.handleFrameExtractionForGif(frameExtractionRequest, sender, (completionResponse) => {
          // Send completion via tab message instead of response callback
          if (sender.tab?.id) {
            chrome.tabs.sendMessage(sender.tab.id, completionResponse).catch(() => {});
          }
        }).catch(error => {
          logger.error('[MessageHandler] Frame extraction failed after acknowledgment', { error });
          // Send error notification to content script
          if (sender.tab?.id) {
            chrome.tabs.sendMessage(sender.tab.id, {
              type: 'GIF_CREATION_COMPLETE',
              success: false,
              error: error instanceof Error ? error.message : 'GIF creation failed'
            }).catch(() => {});
          }
        });

      } catch (error) {
        logger.error('[MessageHandler] Failed to get video data from content script', { error });
        throw createError('youtube', 'Could not access video data for GIF creation');
      }

    } catch (error) {
      logger.error('[MessageHandler] Timeline selection update failed', { error });
      
      // Send error notification to content script
      if (sender.tab?.id) {
        chrome.tabs.sendMessage(sender.tab.id, {
          type: 'GIF_CREATION_COMPLETE',
          success: false,
          error: error instanceof Error ? error.message : 'GIF creation failed'
        }).catch(() => {});
      }
    }
    })(); // End of async IIFE
  }

  // Handle frame extraction specifically for GIF creation (chains to encoding)
  private async handleFrameExtractionForGif(
    message: ExtractFramesRequest,
    sender: chrome.runtime.MessageSender,
    originalSendResponse: (response: ExtensionMessage) => void
  ): Promise<void> {
    try {
      if (this.activeJobs.size >= (this.options.maxConcurrentJobs || 5)) {
        throw createError('video', 'Too many concurrent jobs. Please wait for current jobs to complete.');
      }

      // Add tab ID to the message for service worker to content script communication
      const enrichedMessage = {
        ...message,
        data: {
          ...message.data,
          tabId: sender.tab?.id
        }
      };
      
      logger.info('[MessageHandler] Adding frame extraction job with tabId', { 
        tabId: sender.tab?.id,
        hasTabId: !!sender.tab?.id 
      });
      
      const jobId = backgroundWorker.addFrameExtractionJob(enrichedMessage as ExtractFramesRequest);
      
      this.activeJobs.set(jobId, {
        jobId,
        requestId: message.id,
        sender
      });

      // Monitor frame extraction completion and chain to GIF encoding
      this.monitorJobCompletion(jobId, async (job) => {
        try {
          if (job.status === 'completed') {
            const jobData = job.data as { extractedFrames?: ImageData[] };
            const frames = jobData.extractedFrames || [];
            
            logger.info('[MessageHandler] Frame extraction completed, starting GIF encoding', { 
              jobId, 
              frameCount: frames.length 
            });

            // Create GIF encoding job with extracted frames
            const gifEncodingRequest: EncodeGifRequest = {
              type: 'ENCODE_GIF',
              id: message.id,
              data: {
                frames,
                settings: {
                  frameRate: message.data.settings.frameRate,
                  width: Math.min(480, frames[0]?.width || 480),
                  height: Math.min(360, frames[0]?.height || 360),
                  quality: message.data.settings.quality,
                  loop: true
                },
                metadata: {
                  title: sender.tab?.title || 'YouTube GIF',
                  description: `GIF created from YouTube video`,
                  youtubeUrl: sender.tab?.url || '',
                  startTime: message.data.settings.startTime,
                  endTime: message.data.settings.endTime
                }
              }
            };

            // Start GIF encoding
            await this.handleGifEncodingForTimeline(gifEncodingRequest, sender, originalSendResponse);

          } else if (job.status === 'failed') {
            originalSendResponse({
              type: 'ERROR_RESPONSE',
              success: false,
              error: job.error || 'Frame extraction failed'
            } as ExtensionMessage);
          }
        } finally {
          this.activeJobs.delete(jobId);
        }
      });

    } catch (error) {
      logger.error('[MessageHandler] Frame extraction for GIF failed', { error });
      originalSendResponse({
        type: 'ERROR_RESPONSE',
        success: false,
        error: error instanceof Error ? error.message : 'Frame extraction failed'
      } as ExtensionMessage);
    }
  }

  // Handle GIF encoding specifically for timeline-initiated GIF creation
  private async handleGifEncodingForTimeline(
    message: EncodeGifRequest,
    sender: chrome.runtime.MessageSender,
    originalSendResponse: (response: ExtensionMessage) => void
  ): Promise<void> {
    try {
      if (this.activeJobs.size >= (this.options.maxConcurrentJobs || 5)) {
        throw createError('gif', 'Too many concurrent jobs. Please wait for current jobs to complete.');
      }

      const jobId = backgroundWorker.addGifEncodingJob(message);
      
      this.activeJobs.set(jobId, {
        jobId,
        requestId: message.id,
        sender
      });

      // Monitor GIF encoding completion
      this.monitorJobCompletion(jobId, async (job) => {
        try {
          if (job.status === 'completed') {
            const jobData = job.data as { encodedGif: { gifBlob: Blob; thumbnailBlob: Blob; metadata: Record<string, unknown> } };
            const encodedData = jobData.encodedGif;
            
            // Convert blobs to data URLs for message passing
            // (Blobs can't be sent directly through Chrome messages)
            const gifDataUrl = await this.blobToDataUrl(encodedData.gifBlob);
            const thumbnailDataUrl = encodedData.thumbnailBlob ? 
              await this.blobToDataUrl(encodedData.thumbnailBlob) : undefined;
            
            // Send success response with GIF data as data URLs
            const successResponse: GifCreationComplete = {
              type: 'GIF_CREATION_COMPLETE',
              success: true,
              data: {
                gifBlob: encodedData.gifBlob, // Keep for backward compatibility
                thumbnailBlob: encodedData.thumbnailBlob,
                gifDataUrl, // Add data URL
                thumbnailDataUrl,
                metadata: encodedData.metadata
              }
            };
            originalSendResponse(successResponse);

            logger.info('[MessageHandler] GIF creation completed successfully', { 
              jobId, 
              fileSize: encodedData.metadata.fileSize 
            });

          } else if (job.status === 'failed') {
            originalSendResponse({
              type: 'ERROR_RESPONSE',
              success: false,
              error: job.error || 'GIF encoding failed'
            } as ExtensionMessage);
            logger.error('[MessageHandler] GIF encoding failed', { jobId, error: job.error });
          }
        } finally {
          this.activeJobs.delete(jobId);
        }
      });

    } catch (error) {
      logger.error('[MessageHandler] GIF encoding for timeline failed', { error });
      originalSendResponse({
        type: 'ERROR_RESPONSE',
        success: false,
        error: error instanceof Error ? error.message : 'GIF encoding failed'
      } as ExtensionMessage);
    }
  }

  // Handle job status queries
  private handleJobStatusQuery(
    message: GetJobStatusRequest,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: ExtensionMessage) => void
  ): void {
    try {
      const { jobId } = message.data;
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

  // Handle GIF download request from content script
  private handleGifDownload(
    message: DownloadGifRequest,
    sendResponse: (response: ExtensionMessage) => void
  ): void {
    const { url, filename } = message.data;
    
    logger.info('[MessageHandler] Processing GIF download request', { filename });
    
    chrome.downloads.download({
      url,
      filename,
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        logger.error('[MessageHandler] Download failed', { 
          error: chrome.runtime.lastError.message 
        });
        sendResponse({ 
          type: 'ERROR_RESPONSE',
          success: false, 
          error: chrome.runtime.lastError.message 
        } as ErrorResponse);
      } else {
        logger.info('[MessageHandler] Download started', { downloadId, filename });
        sendResponse({ 
          type: 'SUCCESS_RESPONSE',
          success: true, 
          data: { downloadId }
        } as SuccessResponse);
      }
    });
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
    }, 500); // Update every 500ms for more frequent updates
  }

  // Broadcast progress updates to relevant senders
  private broadcastProgressUpdates(): void {
    for (const [jobId, jobInfo] of this.activeJobs.entries()) {
      const job = backgroundWorker.getJobStatus(jobId);
      
      if (job && job.status === 'processing' && jobInfo.sender.tab?.id) {
        try {
          // Determine stage and message based on job type and progress
          let stage = '';
          let message = '';
          const details: Record<string, unknown> = {};

          if (job.type === 'extract_frames') {
            if (job.progress < 10) {
              stage = 'initializing';
              message = 'Initializing video decoder...';
            } else if (job.progress < 90) {
              stage = 'extracting';
              message = `Extracting frames from video... ${Math.round(job.progress)}%`;
              // Extract frame details if available in job data
              const jobData = job.data as {
                extractedFrames?: unknown[];
                settings?: { endTime: number; startTime: number; frameRate: number };
              };
              if (jobData.extractedFrames) {
                details.currentFrame = jobData.extractedFrames.length;
                details.totalFrames = jobData.settings ? Math.ceil((jobData.settings.endTime - jobData.settings.startTime) * jobData.settings.frameRate) : 0;
              }
            } else {
              stage = 'finalizing';
              message = 'Finalizing frame extraction...';
            }
          } else if (job.type === 'encode_gif') {
            if (job.progress < 10) {
              stage = 'preparing';
              message = 'Preparing GIF encoder...';
            } else if (job.progress < 40) {
              stage = 'encoding';
              message = `Encoding frames to GIF... ${Math.round(job.progress)}%`;
              const jobData = job.data as { frames?: unknown[] };
              if (jobData.frames) {
                details.totalFrames = jobData.frames.length;
                details.currentFrame = Math.floor((job.progress / 100) * jobData.frames.length);
              }
            } else if (job.progress < 70) {
              stage = 'optimizing';
              message = `Optimizing GIF colors and size... ${Math.round(job.progress)}%`;
            } else if (job.progress < 90) {
              stage = 'compressing';
              message = `Compressing GIF... ${Math.round(job.progress)}%`;
            } else {
              stage = 'finalizing';
              message = 'Creating thumbnail and finalizing...';
            }
          }

          chrome.tabs.sendMessage(jobInfo.sender.tab.id, {
            type: 'JOB_PROGRESS_UPDATE',
            data: {
              jobId,
              progress: job.progress,
              status: job.status,
              stage,
              message,
              details
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