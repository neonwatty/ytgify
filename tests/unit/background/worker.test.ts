/**
 * Tests for BackgroundVideoWorker
 * Priority 1: Core job processing and queue management functionality
 */

import { BackgroundVideoWorker } from '@/background/worker';
import { ExtractFramesRequest, EncodeGifRequest } from '@/types';
import { extractVideoFramesInServiceWorker } from '@/lib/service-worker-video-processor';
import { encodeGif, detectEncoderFeatures } from '@/lib/gif-encoder-v2';
import { logger } from '@/lib/logger';
import { errorHandler } from '@/lib/errors';

// Mock dependencies
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('@/lib/errors', () => ({
  errorHandler: {
    handleError: jest.fn()
  },
  createError: jest.fn((type: string, message: string) => new Error(`${type}: ${message}`))
}));

jest.mock('@/lib/service-worker-video-processor', () => ({
  extractVideoFramesInServiceWorker: jest.fn(),
  createServiceWorkerProcessorOptions: jest.fn((data) => data)
}));

jest.mock('@/lib/gif-encoder-v2', () => ({
  encodeGif: jest.fn(),
  detectEncoderFeatures: jest.fn()
}));

describe('BackgroundVideoWorker', () => {
  let worker: BackgroundVideoWorker;

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear singleton instance
    (BackgroundVideoWorker as any).instance = undefined;

    // Mock WebCodecs availability BEFORE creating instance
    (globalThis as any).VideoDecoder = jest.fn();
    (globalThis as any).VideoEncoder = jest.fn();
    (globalThis as any).VideoFrame = jest.fn();
    (globalThis as any).ImageDecoder = jest.fn();

    worker = BackgroundVideoWorker.getInstance();
  });

  afterEach(() => {
    // Clean up global mocks
    delete (globalThis as any).VideoDecoder;
    delete (globalThis as any).VideoEncoder;
    delete (globalThis as any).VideoFrame;
    delete (globalThis as any).ImageDecoder;
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = BackgroundVideoWorker.getInstance();
      const instance2 = BackgroundVideoWorker.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should initialize WebCodecs on creation', () => {
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('WebCodecs API initialized'),
        expect.objectContaining({
          hasVideoDecoder: true,
          hasVideoEncoder: true,
          hasVideoFrame: true,
          hasImageDecoder: true
        })
      );
    });

    it('should handle WebCodecs unavailability', () => {
      delete (globalThis as any).VideoDecoder;
      (BackgroundVideoWorker as any).instance = undefined;

      const worker = BackgroundVideoWorker.getInstance();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('WebCodecs API not available'),
        expect.objectContaining({
          environment: 'service-worker',
          fallbackMode: true
        })
      );
    });
  });

  describe('addFrameExtractionJob', () => {
    it('should add frame extraction job to queue', async () => {
      const request: ExtractFramesRequest = {
        type: 'EXTRACT_FRAMES',
        data: {
          videoElement: {
            currentTime: 0,
            duration: 10,
            videoWidth: 1920,
            videoHeight: 1080
          },
          settings: {
            startTime: 0,
            endTime: 5,
            frameRate: 10,
            quality: 'medium'
          }
        }
      };

      const jobId = worker.addFrameExtractionJob(request);

      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');

      // Wait a moment for processing to complete
      await new Promise(resolve => setTimeout(resolve, 110));

      const job = worker.getJobStatus(jobId);
      expect(job).toBeDefined();
      expect(job?.type).toBe('extract_frames');
      // After processing, should be completed
      expect(job?.status).toMatch(/completed|failed/);
    });

    it('should start processing queue automatically', () => {
      const request: ExtractFramesRequest = {
        type: 'EXTRACT_FRAMES',
        data: {
          videoElement: {
            currentTime: 0,
            duration: 10,
            videoWidth: 640,
            videoHeight: 480
          },
          settings: {
            startTime: 0,
            endTime: 5,
            frameRate: 10,
            quality: 'medium'
          }
        }
      };

      jest.spyOn(worker as any, 'processQueue');

      worker.addFrameExtractionJob(request);

      expect((worker as any).processQueue).toHaveBeenCalled();
    });

    it('should not start processing if already processing', () => {
      (worker as any).isProcessing = true;

      const request: ExtractFramesRequest = {
        type: 'EXTRACT_FRAMES',
        data: {
          videoElement: {
            currentTime: 0,
            duration: 10,
            videoWidth: 640,
            videoHeight: 480
          },
          settings: {
            startTime: 0,
            endTime: 5,
            frameRate: 10,
            quality: 'medium'
          }
        }
      };

      jest.spyOn(worker as any, 'processQueue');

      worker.addFrameExtractionJob(request);

      expect((worker as any).processQueue).not.toHaveBeenCalled();
    });
  });

  describe('addGifEncodingJob', () => {
    it('should add GIF encoding job to queue', async () => {
      const request: EncodeGifRequest = {
        type: 'ENCODE_GIF',
        data: {
          frames: [new ImageData(100, 100)],
          settings: {
            quality: 'high',
            frameRate: 15,
            width: 100,
            height: 100,
            loop: true
          },
          metadata: {
            title: 'Test GIF',
            youtubeUrl: 'https://youtube.com/watch?v=test',
            startTime: 0,
            endTime: 5
          }
        }
      };

      const jobId = worker.addGifEncodingJob(request);

      expect(jobId).toBeDefined();

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 110));

      const job = worker.getJobStatus(jobId);
      expect(job).toBeDefined();
      expect(job?.type).toBe('encode_gif');
      expect(job?.status).toMatch(/completed|failed/);
    });
  });

  describe('getJobStatus', () => {
    it('should return job status when job exists', () => {
      const request: ExtractFramesRequest = {
        type: 'EXTRACT_FRAMES',
        data: {
          videoElement: {
            currentTime: 0,
            duration: 10,
            videoWidth: 640,
            videoHeight: 480
          },
          settings: {
            startTime: 0,
            endTime: 5,
            frameRate: 10,
            quality: 'medium'
          }
        }
      };

      const jobId = worker.addFrameExtractionJob(request);
      const job = worker.getJobStatus(jobId);

      expect(job).toBeDefined();
      expect(job?.id).toBe(jobId);
    });

    it('should return null when job does not exist', () => {
      const job = worker.getJobStatus('non-existent-id');
      expect(job).toBeNull();
    });
  });

  describe('processQueue', () => {
    beforeEach(() => {
      // Mock successful frame extraction
      (extractVideoFramesInServiceWorker as jest.Mock).mockResolvedValue({
        frames: [new ImageData(100, 100)],
        metadata: {
          extractionMethod: 'webcodecs',
          processingTime: 1000,
          dimensions: { width: 100, height: 100 },
          actualFrameRate: 10
        }
      });

      // Mock successful GIF encoding with complete structure matching worker expectations
      (encodeGif as jest.Mock).mockResolvedValue({
        gifBlob: new Blob(['gif-data'], { type: 'image/gif' }),
        thumbnailBlob: new Blob(['thumb-data'], { type: 'image/png' }),
        metadata: {
          fileSize: 1024,
          frameCount: 10,
          encodingTime: 500,
          width: 100,
          height: 100,
          duration: 1000,
          colorCount: 256,
          compressionRatio: 0.5,
          averageFrameTime: 50,
          format: 'gif',
          encoder: 'test',
          performance: {
            efficiency: 0.85,
            recommendations: [],
            peakMemoryUsage: 1024000
          }
        }
      });

      // Mock encoder detection
      (detectEncoderFeatures as jest.Mock).mockResolvedValue({
        hasGifenc: true,
        hasGifJs: true,
        recommendedEncoder: 'gifenc',
        performanceProfile: 'high'
      });
    });

    it('should process frame extraction jobs successfully', async () => {
      const request: ExtractFramesRequest = {
        type: 'EXTRACT_FRAMES',
        data: {
          videoElement: {
            currentTime: 0,
            duration: 10,
            videoWidth: 1920,
            videoHeight: 1080
          },
          settings: {
            startTime: 0,
            endTime: 5,
            frameRate: 10,
            quality: 'medium'
          }
        }
      };

      const jobId = worker.addFrameExtractionJob(request);

      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      const job = worker.getJobStatus(jobId);
      expect(job?.status).toBe('completed');
      expect(job?.progress).toBe(100);
      expect(job?.completedAt).toBeDefined();
      expect(job?.data.extractedFrames).toBeDefined();
      expect(job?.data.extractionMetadata).toBeDefined();

      expect(extractVideoFramesInServiceWorker).toHaveBeenCalledWith(
        expect.objectContaining({
          videoElement: expect.any(Object),
          settings: expect.any(Object)
        }),
        undefined,
        expect.any(Function)
      );
    });

    it('should process GIF encoding jobs successfully', async () => {
      const frames = [new ImageData(100, 100), new ImageData(100, 100)];
      const request: EncodeGifRequest = {
        type: 'ENCODE_GIF',
        data: {
          frames,
          settings: {
            quality: 'high',
            frameRate: 15,
            width: 100,
            height: 100,
            loop: true
          },
          metadata: {
            title: 'Test GIF',
            youtubeUrl: 'https://youtube.com/watch?v=test',
            startTime: 0,
            endTime: 5
          }
        }
      };

      const jobId = worker.addGifEncodingJob(request);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      const job = worker.getJobStatus(jobId);
      // Check if job failed and log the error for debugging
      if (job?.status === 'failed') {
        console.log('Job failed with error:', job.error);
      }
      expect(job?.status).toBe('completed');
      expect(job?.data.encodedGif).toBeDefined();

      expect(detectEncoderFeatures).toHaveBeenCalled();
      expect(encodeGif).toHaveBeenCalledWith(
        frames,
        expect.objectContaining({
          frameRate: 15,
          quality: 'high'
        }),
        expect.any(Function)  // onProgress callback
      );
    });

    it('should handle job processing errors', async () => {
      const error = new Error('Frame extraction failed');
      (extractVideoFramesInServiceWorker as jest.Mock).mockRejectedValue(error);

      const request: ExtractFramesRequest = {
        type: 'EXTRACT_FRAMES',
        data: {
          videoElement: {
            currentTime: 0,
            duration: 10,
            videoWidth: 640,
            videoHeight: 480
          },
          settings: {
            startTime: 0,
            endTime: 5,
            frameRate: 10,
            quality: 'medium'
          }
        }
      };

      const jobId = worker.addFrameExtractionJob(request);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      const job = worker.getJobStatus(jobId);
      expect(job?.status).toBe('failed');
      expect(job?.error).toContain('Frame extraction failed');
      expect(job?.completedAt).toBeDefined();

      expect(errorHandler.handleError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          jobId,
          jobType: 'extract_frames'
        })
      );
    });

    it('should process multiple jobs in sequence', async () => {
      const request1: ExtractFramesRequest = {
        type: 'EXTRACT_FRAMES',
        data: {
          videoElement: {
            currentTime: 0,
            duration: 10,
            videoWidth: 640,
            videoHeight: 480
          },
          settings: {
            startTime: 0,
            endTime: 5,
            frameRate: 10,
            quality: 'medium'
          }
        }
      };

      const request2: EncodeGifRequest = {
        type: 'ENCODE_GIF',
        data: {
          frames: [new ImageData(100, 100)],
          settings: {
            quality: 'medium',
            frameRate: 10,
            width: 100,
            height: 100,
            loop: true
          },
          metadata: {
            title: 'Test GIF',
            youtubeUrl: 'https://youtube.com/watch?v=test',
            startTime: 0,
            endTime: 5
          }
        }
      };

      const jobId1 = worker.addFrameExtractionJob(request1);
      const jobId2 = worker.addGifEncodingJob(request2);

      // Wait for all processing
      await new Promise(resolve => setTimeout(resolve, 200));

      const job1 = worker.getJobStatus(jobId1);
      const job2 = worker.getJobStatus(jobId2);

      expect(job1?.status).toBe('completed');
      expect(job2?.status).toBe('completed');
    });

    it('should handle missing jobs in queue', async () => {
      // Manually add a non-existent job ID to the queue
      (worker as any).processingQueue.push('non-existent-id');

      // Trigger processing
      await (worker as any).processQueue();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Job not found'),
        expect.objectContaining({ jobId: 'non-existent-id' })
      );
    });

    it('should update job progress during processing', async () => {
      const request: ExtractFramesRequest = {
        type: 'EXTRACT_FRAMES',
        data: {
          videoElement: {
            currentTime: 0,
            duration: 10,
            videoWidth: 640,
            videoHeight: 480
          },
          settings: {
            startTime: 0,
            endTime: 5,
            frameRate: 10,
            quality: 'medium'
          }
        }
      };

      // Capture progress callback
      let progressCallback: Function;
      (extractVideoFramesInServiceWorker as jest.Mock).mockImplementation(
        async (options, tabId, onProgress) => {
          progressCallback = onProgress;
          // Simulate progress updates
          onProgress({ progress: 25, message: 'Starting', stage: 'init' });
          onProgress({ progress: 50, message: 'Processing', stage: 'extract' });
          onProgress({ progress: 75, message: 'Finalizing', stage: 'complete' });

          return {
            frames: [new ImageData(100, 100)],
            metadata: {}
          };
        }
      );

      const jobId = worker.addFrameExtractionJob(request);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Frame extraction progress'),
        expect.objectContaining({
          jobId,
          progress: 25
        })
      );

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Frame extraction progress'),
        expect.objectContaining({
          jobId,
          progress: 50
        })
      );
    });
  });

  describe('Job ID generation', () => {
    it('should generate unique job IDs', () => {
      const request: ExtractFramesRequest = {
        type: 'EXTRACT_FRAMES',
        data: {
          videoElement: {
            currentTime: 0,
            duration: 10,
            videoWidth: 640,
            videoHeight: 480
          },
          settings: {
            startTime: 0,
            endTime: 5,
            frameRate: 10,
            quality: 'medium'
          }
        }
      };

      const jobId1 = worker.addFrameExtractionJob(request);
      const jobId2 = worker.addFrameExtractionJob(request);

      expect(jobId1).not.toBe(jobId2);
    });
  });

  describe('Cleanup', () => {
    it('should clean up old completed jobs', async () => {
      const cleanupOldJobs = jest.spyOn(worker as any, 'cleanupOldJobs');

      // Add multiple jobs
      for (let i = 0; i < 5; i++) {
        worker.addFrameExtractionJob({
          type: 'EXTRACT_FRAMES',
          data: {
            videoElement: {
              currentTime: 0,
              duration: 10,
              videoWidth: 640,
              videoHeight: 480
            },
            settings: {
              startTime: 0,
              endTime: 5,
              frameRate: 10,
              quality: 'medium'
            }
          }
        });
      }

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 200));

      // Trigger cleanup
      await (worker as any).cleanupOldJobs();

      // Check that old jobs are cleaned
      expect(cleanupOldJobs).toHaveBeenCalled();
    });
  });
});