/**
 * Tests for BackgroundMessageHandler
 * Priority 1: Core message routing and handling tests
 */

import {
  BackgroundMessageHandler,
  MessageHandlerOptions
} from '@/background/message-handler';

import {
  ExtractFramesRequest,
  ExtractFramesResponse,
  EncodeGifRequest,
  EncodeGifResponse,
  GetVideoStateRequest,
  GetVideoStateResponse,
  TimelineSelectionUpdate,
  SaveGifRequest,
  SaveGifResponse,
  DownloadGifRequest,
  GetJobStatusRequest,
  GifCreationComplete
} from '@/types';

import { chromeMock, simulateRuntimeMessage } from '../__mocks__/chrome-mocks';

// Mock dependencies
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    log: jest.fn()
  }
}));

jest.mock('@/lib/errors', () => ({
  errorHandler: {
    handleError: jest.fn()
  },
  createError: jest.fn((type: string, message: string) => new Error(`${type}: ${message}`))
}));

jest.mock('@/background/worker', () => {
  let jobCounter = 0;
  return {
    backgroundWorker: {
      addFrameExtractionJob: jest.fn().mockImplementation(() => `job-${++jobCounter}`),
      addGifEncodingJob: jest.fn().mockImplementation(() => `encode-job-${++jobCounter}`),
      getJobStatus: jest.fn(),
      getQueueStatus: jest.fn().mockReturnValue({
        total: 0,
        processing: 0,
        pending: 0,
        completed: 0,
        failed: 0
      }),
      cleanupOldJobs: jest.fn()
    }
  };
});

describe('BackgroundMessageHandler', () => {
  let messageHandler: BackgroundMessageHandler;
  let mockSender: chrome.runtime.MessageSender;
  let mockSendResponse: jest.MockedFunction<(response: any) => void>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset singleton instance to ensure fresh state for each test
    (BackgroundMessageHandler as any).instance = null;

    // Set up Chrome API mock
    (global as any).chrome = chromeMock;

    // Create message handler instance
    const options: MessageHandlerOptions = {
      enableProgressUpdates: false, // Disable for easier testing
      maxConcurrentJobs: 3,
      jobTimeout: 5000
    };
    messageHandler = BackgroundMessageHandler.getInstance(options);

    // Mock sender (simulating content script)
    mockSender = {
      tab: {
        id: 123,
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        title: 'Test YouTube Video',
        index: 0,
        pinned: false,
        highlighted: false,
        windowId: 1,
        active: true,
        incognito: false,
        selected: false,
        discarded: false,
        autoDiscardable: true
      }
    } as any;

    mockSendResponse = jest.fn();

    // Reset background worker mocks
    const { backgroundWorker } = require('@/background/worker');
    // Note: addFrameExtractionJob and addGifEncodingJob now return dynamic IDs
    backgroundWorker.getJobStatus.mockReturnValue({
      id: 'dynamic-job-id', // This will be updated per test as needed
      type: 'extract_frames',
      status: 'completed',
      progress: 100,
      data: { extractedFrames: [new ImageData(480, 360)] },
      createdAt: new Date(),
      completedAt: new Date()
    });
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = BackgroundMessageHandler.getInstance();
      const instance2 = BackgroundMessageHandler.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should initialize with default options', () => {
      const handler = BackgroundMessageHandler.getInstance();
      expect(handler).toBeInstanceOf(BackgroundMessageHandler);
    });
  });

  describe('handleMessage', () => {
    describe('frame extraction requests', () => {
      const createFrameExtractionRequest = (): ExtractFramesRequest => ({
        type: 'EXTRACT_FRAMES',
        id: 'test-request-123',
        data: {
          videoElement: {
            videoWidth: 1920,
            videoHeight: 1080,
            duration: 100,
            currentTime: 10
          } as any,
          settings: {
            startTime: 5,
            endTime: 15,
            frameRate: 10,
            quality: 'medium'
          }
        }
      });

      it('should handle frame extraction request successfully', async () => {
        const request = createFrameExtractionRequest();

        const returnValue = await messageHandler.handleMessage(request, mockSender, mockSendResponse);
        expect(returnValue).toBe(true); // Indicates async response

        const { backgroundWorker } = require('@/background/worker');
        expect(backgroundWorker.addFrameExtractionJob).toHaveBeenCalledWith(
          expect.objectContaining({
            ...request,
            data: expect.objectContaining({
              tabId: 123
            })
          })
        );
      });

      it('should reject frame extraction when at job limit', async () => {
        const request = createFrameExtractionRequest();

        // Fill up job queue
        messageHandler.handleMessage(request, mockSender, jest.fn());
        messageHandler.handleMessage(request, mockSender, jest.fn());
        messageHandler.handleMessage(request, mockSender, jest.fn());

        // This should be rejected
        await messageHandler.handleMessage(request, mockSender, mockSendResponse);

        expect(mockSendResponse).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'EXTRACT_FRAMES_RESPONSE',
            success: false,
            error: expect.stringContaining('Too many concurrent jobs')
          })
        );
      });

      it('should handle frame extraction completion', (done) => {
        const request = createFrameExtractionRequest();

        // Mock successful job completion
        const { backgroundWorker } = require('@/background/worker');
        backgroundWorker.getJobStatus.mockReturnValue({
          id: 'job-123',
          type: 'extract_frames',
          status: 'completed',
          progress: 100,
          data: { extractedFrames: [new ImageData(480, 360), new ImageData(480, 360)] },
          createdAt: new Date(),
          completedAt: new Date()
        });

        const mockResponse = jest.fn((response: any) => {
          expect(response).toEqual({
            type: 'EXTRACT_FRAMES_RESPONSE',
            id: 'test-request-123',
            success: true,
            data: {
              frames: expect.arrayContaining([expect.any(ImageData)]),
              frameCount: 2
            }
          });
          done();
        });

        messageHandler.handleMessage(request, mockSender, mockResponse);
      });

      it('should handle frame extraction failure', (done) => {
        const request = createFrameExtractionRequest();

        // Mock failed job
        const { backgroundWorker } = require('@/background/worker');
        backgroundWorker.getJobStatus.mockReturnValue({
          id: 'job-123',
          type: 'extract_frames',
          status: 'failed',
          progress: 0,
          error: 'Video not accessible',
          createdAt: new Date()
        });

        const mockResponse = jest.fn((response: any) => {
          expect(response).toEqual({
            type: 'EXTRACT_FRAMES_RESPONSE',
            id: 'test-request-123',
            success: false,
            error: 'Video not accessible'
          });
          done();
        });

        messageHandler.handleMessage(request, mockSender, mockResponse);
      });
    });

    describe('GIF encoding requests', () => {
      const createGifEncodingRequest = (): EncodeGifRequest => ({
        type: 'ENCODE_GIF',
        id: 'encode-request-456',
        data: {
          frames: [new ImageData(480, 360), new ImageData(480, 360)],
          settings: {
            width: 480,
            height: 360,
            frameRate: 10,
            quality: 'medium',
            loop: true
          },
          metadata: {
            title: 'Test GIF',
            description: 'Test GIF Description',
            youtubeUrl: 'https://www.youtube.com/watch?v=test',
            startTime: 5,
            endTime: 10
          }
        }
      });

      it('should handle GIF encoding request successfully', async () => {
        const request = createGifEncodingRequest();

        const returnValue = await messageHandler.handleMessage(request, mockSender, mockSendResponse);
        expect(returnValue).toBe(true);

        const { backgroundWorker } = require('@/background/worker');
        expect(backgroundWorker.addGifEncodingJob).toHaveBeenCalledWith(request);
      });

      it('should handle GIF encoding completion', (done) => {
        const request = createGifEncodingRequest();

        // Mock successful encoding completion
        const { backgroundWorker } = require('@/background/worker');
        backgroundWorker.getJobStatus.mockReturnValue({
          id: 'job-456',
          type: 'encode_gif',
          status: 'completed',
          progress: 100,
          data: {
            encodedGif: {
              gifBlob: new Blob(['gif-data'], { type: 'image/gif' }),
              thumbnailBlob: new Blob(['thumb-data'], { type: 'image/png' }),
              metadata: {
                fileSize: 1024,
                duration: 5,
                width: 480,
                height: 360
              }
            }
          },
          createdAt: new Date(),
          completedAt: new Date()
        });

        const mockResponse = jest.fn((response: any) => {
          expect(response).toEqual({
            type: 'ENCODE_GIF_RESPONSE',
            id: 'encode-request-456',
            success: true,
            data: expect.objectContaining({
              gifBlob: expect.any(Blob),
              thumbnailBlob: expect.any(Blob),
              metadata: expect.objectContaining({
                fileSize: 1024,
                width: 480,
                height: 360
              })
            })
          });
          done();
        });

        messageHandler.handleMessage(request, mockSender, mockResponse);
      });
    });

    describe('video state requests', () => {
      const createVideoStateRequest = (): GetVideoStateRequest => ({
        type: 'GET_VIDEO_STATE',
        id: 'video-state-123'
      });

      it('should handle video state request', async () => {
        const request = createVideoStateRequest();

        await messageHandler.handleMessage(request, mockSender, mockSendResponse);

        expect(mockSendResponse).toHaveBeenCalledWith({
          type: 'GET_VIDEO_STATE_RESPONSE',
          id: 'video-state-123',
          success: true,
          data: {
            isPlaying: false,
            currentTime: 0,
            duration: 0,
            videoUrl: mockSender.tab!.url,
            title: mockSender.tab!.title
          }
        });
      });

      it('should handle video state request without tab', async () => {
        const request = createVideoStateRequest();
        const senderWithoutTab = { ...mockSender, tab: undefined };

        await messageHandler.handleMessage(request, senderWithoutTab, mockSendResponse);

        expect(mockSendResponse).toHaveBeenCalledWith({
          type: 'GET_VIDEO_STATE_RESPONSE',
          id: 'video-state-123',
          success: false,
          error: expect.stringContaining('No active tab found')
        });
      });
    });

    describe('timeline selection updates', () => {
      const createTimelineSelectionUpdate = (): TimelineSelectionUpdate => ({
        type: 'TIMELINE_SELECTION_UPDATE',
        id: 'timeline-123',
        data: {
          startTime: 10,
          endTime: 20,
          duration: 10
        }
      });

      it('should handle timeline selection update', async () => {
        const request = createTimelineSelectionUpdate();

        const returnValue = await messageHandler.handleMessage(request, mockSender, mockSendResponse);
        expect(returnValue).toBe(false); // Response sent immediately

        expect(mockSendResponse).toHaveBeenCalledWith({
          type: 'SUCCESS_RESPONSE',
          success: true,
          data: { message: 'GIF creation started' }
        });
      });

      it('should reject timeline selection that is too short', async () => {
        const request: TimelineSelectionUpdate = {
          type: 'TIMELINE_SELECTION_UPDATE',
          id: 'timeline-123',
          data: {
            startTime: 10,
            endTime: 10.3,
            duration: 0.3 // Too short
          }
        };

        await messageHandler.handleMessage(request, mockSender, mockSendResponse);

        // Should still send success response immediately
        expect(mockSendResponse).toHaveBeenCalledWith({
          type: 'SUCCESS_RESPONSE',
          success: true,
          data: { message: 'GIF creation started' }
        });

        // But should send error via tab message
        expect(chromeMock.tabs.sendMessage).toHaveBeenCalledWith(
          123,
          expect.objectContaining({
            type: 'GIF_CREATION_COMPLETE',
            success: false,
            error: expect.stringContaining('too short')
          })
        );
      });

      it('should reject timeline selection that is too long', async () => {
        const request: TimelineSelectionUpdate = {
          type: 'TIMELINE_SELECTION_UPDATE',
          id: 'timeline-123',
          data: {
            startTime: 0,
            endTime: 35,
            duration: 35 // Too long
          }
        };

        await messageHandler.handleMessage(request, mockSender, mockSendResponse);

        expect(chromeMock.tabs.sendMessage).toHaveBeenCalledWith(
          123,
          expect.objectContaining({
            type: 'GIF_CREATION_COMPLETE',
            success: false,
            error: expect.stringContaining('too long')
          })
        );
      });
    });

    describe('download requests', () => {
      const createDownloadRequest = (): DownloadGifRequest => ({
        type: 'DOWNLOAD_GIF',
        data: {
          url: 'blob:chrome-extension://test-id/test-blob',
          filename: 'test-gif.gif'
        }
      });

      it('should handle download request successfully', async () => {
        const request = createDownloadRequest();

        // Mock successful download
        (chromeMock as any).downloads = {
          download: jest.fn((options, callback) => {
            callback(123); // downloadId
          })
        };

        const returnValue = await messageHandler.handleMessage(request, mockSender, mockSendResponse);
        expect(returnValue).toBe(true);

        expect((chromeMock as any).downloads.download).toHaveBeenCalledWith(
          {
            url: request.data.url,
            filename: request.data.filename,
            saveAs: false
          },
          expect.any(Function)
        );

        expect(mockSendResponse).toHaveBeenCalledWith({
          type: 'SUCCESS_RESPONSE',
          success: true,
          data: { downloadId: 123 }
        });
      });

      it('should handle download failure', async () => {
        const request = createDownloadRequest();

        // Mock download failure
        (chromeMock as any).downloads = {
          download: jest.fn((options, callback) => {
            (chromeMock.runtime as any).lastError = { message: 'Download failed' };
            callback(undefined);
          })
        };

        await messageHandler.handleMessage(request, mockSender, mockSendResponse);

        expect(mockSendResponse).toHaveBeenCalledWith({
          type: 'ERROR_RESPONSE',
          success: false,
          error: 'Download failed'
        });
      });
    });

    describe('job status requests', () => {
      const createJobStatusRequest = (): GetJobStatusRequest => ({
        type: 'GET_JOB_STATUS',
        data: {
          jobId: 'job-123'
        }
      });

      it('should handle job status request for existing job', async () => {
        const request = createJobStatusRequest();

        // Mock job exists
        const { backgroundWorker } = require('@/background/worker');
        backgroundWorker.getJobStatus.mockReturnValue({
          id: 'job-123',
          type: 'extract_frames',
          status: 'processing',
          progress: 50,
          createdAt: new Date('2024-01-01T10:00:00Z'),
          completedAt: null
        });

        await messageHandler.handleMessage(request, mockSender, mockSendResponse);

        expect(mockSendResponse).toHaveBeenCalledWith({
          type: 'JOB_STATUS_RESPONSE',
          success: true,
          data: {
            jobId: 'job-123',
            status: 'processing',
            progress: 50,
            error: undefined,
            createdAt: '2024-01-01T10:00:00.000Z',
            completedAt: undefined
          }
        });
      });

      it('should handle job status request for non-existent job', async () => {
        const request = createJobStatusRequest();

        // Mock job doesn't exist
        const { backgroundWorker } = require('@/background/worker');
        backgroundWorker.getJobStatus.mockReturnValue(null);

        await messageHandler.handleMessage(request, mockSender, mockSendResponse);

        expect(mockSendResponse).toHaveBeenCalledWith({
          type: 'JOB_STATUS_RESPONSE',
          success: false,
          error: 'Job not found'
        });
      });
    });

    describe('unknown message types', () => {
      it('should handle unknown message type', async () => {
        const unknownMessage = {
          type: 'UNKNOWN_MESSAGE_TYPE',
          id: 'unknown-123'
        } as any;

        const returnValue = await messageHandler.handleMessage(unknownMessage, mockSender, mockSendResponse);
        expect(returnValue).toBe(false);

        expect(mockSendResponse).toHaveBeenCalledWith({
          type: 'ERROR_RESPONSE',
          success: false,
          error: 'Unknown message type: UNKNOWN_MESSAGE_TYPE'
        });
      });
    });

    describe('error handling', () => {
      it('should handle message processing errors', async () => {
        const request = {
          type: 'EXTRACT_FRAMES',
          id: 'error-test',
          data: null // Invalid data to cause error
        } as any;

        await messageHandler.handleMessage(request, mockSender, mockSendResponse);

        expect(mockSendResponse).toHaveBeenCalledWith({
          type: 'EXTRACT_FRAMES_RESPONSE',
          id: 'error-test',
          success: false,
          error: expect.any(String)
        });
      });

      it('should handle sender without tab ID', async () => {
        const request: GetVideoStateRequest = {
          type: 'GET_VIDEO_STATE',
          id: 'no-tab-test'
        };

        const senderWithoutTab = { ...mockSender, tab: undefined };

        await messageHandler.handleMessage(request, senderWithoutTab, mockSendResponse);

        expect(mockSendResponse).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            error: expect.stringContaining('No active tab')
          })
        );
      });
    });
  });

  describe('getStatistics', () => {
    it('should return handler statistics', () => {
      const stats = messageHandler.getStatistics();

      expect(stats).toEqual({
        activeJobs: expect.any(Number),
        maxConcurrentJobs: 3,
        workerQueue: expect.objectContaining({
          total: expect.any(Number),
          processing: expect.any(Number),
          pending: expect.any(Number),
          completed: expect.any(Number),
          failed: expect.any(Number)
        }),
        progressUpdatesEnabled: false
      });
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', () => {
      messageHandler.cleanup();

      const { backgroundWorker } = require('@/background/worker');
      expect(backgroundWorker.cleanupOldJobs).toHaveBeenCalled();
    });
  });

  describe('concurrent job limits', () => {
    it('should track active jobs correctly', async () => {
      const requests = [
        { type: 'EXTRACT_FRAMES', id: '1', data: { videoElement: {}, settings: {} } },
        { type: 'EXTRACT_FRAMES', id: '2', data: { videoElement: {}, settings: {} } },
        { type: 'EXTRACT_FRAMES', id: '3', data: { videoElement: {}, settings: {} } }
      ] as ExtractFramesRequest[];

      // Submit all requests
      for (const request of requests) {
        await messageHandler.handleMessage(request, mockSender, jest.fn());
      }

      // Fourth request should be rejected
      const fourthRequest: ExtractFramesRequest = {
        type: 'EXTRACT_FRAMES',
        id: '4',
        data: { videoElement: {} as any, settings: {} as any }
      };

      await messageHandler.handleMessage(fourthRequest, mockSender, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Too many concurrent jobs')
        })
      );
    });
  });

  describe('logging messages', () => {
    it('should handle log messages', async () => {
      const logMessage = {
        type: 'LOG',
        data: {
          level: 'info',
          message: 'Test log message',
          context: { source: 'content-script' }
        }
      } as any;

      const returnValue = await messageHandler.handleMessage(logMessage, mockSender, mockSendResponse);
      expect(returnValue).toBe(false); // No response needed

      const { logger } = require('@/lib/logger');
      expect(logger.log).toHaveBeenCalledWith(
        'info',
        'Test log message',
        { source: 'content-script' },
        'background'
      );
    });
  });

  describe('job cancellation', () => {
    it('should handle job cancellation', async () => {
      const cancelMessage = {
        type: 'CANCEL_JOB',
        data: { jobId: 'job-to-cancel' }
      } as any;

      await messageHandler.handleMessage(cancelMessage, mockSender, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        type: 'JOB_CANCEL_RESPONSE',
        success: true,
        data: { jobId: 'job-to-cancel', cancelled: true }
      });
    });
  });

  describe('progress tracking', () => {
    it('should handle progress updates when enabled', () => {
      // Reset singleton to ensure fresh instance with new options
      (BackgroundMessageHandler as any).instance = null;

      const optionsWithProgress: MessageHandlerOptions = {
        enableProgressUpdates: true,
        maxConcurrentJobs: 3,
        jobTimeout: 5000
      };

      const handlerWithProgress = BackgroundMessageHandler.getInstance(optionsWithProgress);
      const stats = handlerWithProgress.getStatistics();

      expect(stats.progressUpdatesEnabled).toBe(true);

      // Clean up the handler to prevent timer leaks
      handlerWithProgress.cleanup();
      (BackgroundMessageHandler as any).instance = null;
    });
  });

  describe('message validation', () => {
    it('should handle malformed message data', async () => {
      const malformedMessage = {
        type: 'EXTRACT_FRAMES',
        id: 'malformed',
        data: 'not-an-object' // Should be object
      } as any;

      await messageHandler.handleMessage(malformedMessage, mockSender, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'EXTRACT_FRAMES_RESPONSE',
          id: 'malformed',
          success: false
        })
      );
    });

    it('should handle missing required fields', async () => {
      const incompleteMessage = {
        type: 'EXTRACT_FRAMES',
        // Missing id and data
      } as any;

      await messageHandler.handleMessage(incompleteMessage, mockSender, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'EXTRACT_FRAMES_RESPONSE',
          id: undefined,
          success: false
        })
      );
    });
  });
});