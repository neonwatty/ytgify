// Simplified frame extraction that captures frames in real-time without seeking
import { logger } from './logger';
import { createError } from './errors';

/** @internal */
export interface SimpleFrameExtractionOptions {
  startTime: number;
  endTime: number;
  frameRate: number;
  quality: 'low' | 'medium' | 'high';
  maxWidth?: number;
  maxHeight?: number;
}

/** @internal */
export interface SimpleFrameExtractionResult {
  frames: ImageData[];
  metadata: {
    totalFrames: number;
    actualFrameRate: number;
    dimensions: { width: number; height: number };
    duration: number;
    extractionMethod: 'simple-capture';
    processingTime: number;
  };
}

/**
 * Wait for video to be ready for frame capture at current time
 * Checks both readyState and buffering progress
 */
async function waitForVideoReady(
  videoElement: HTMLVideoElement,
  targetTime: number,
  maxWaitMs = 3000
): Promise<{ ready: boolean; reason?: string }> {
  const startWait = performance.now();
  let lastBufferCheck = 0;
  let stuckCount = 0;
  let lastReadyState = videoElement.readyState;
  let readyStateStuckCount = 0;

  while (performance.now() - startWait < maxWaitMs) {
    const currentReadyState = videoElement.readyState;

    // Detect if readyState is stuck at 0 or 1 (network issue, geo-restriction, etc.)
    if (currentReadyState === lastReadyState && currentReadyState < 2) {
      readyStateStuckCount++;
      // If readyState hasn't changed in 1 second, likely a permanent issue
      if (readyStateStuckCount >= 40) {
        // 40 * 25ms = 1000ms
        logger.error(
          `[SimpleFrameExtractor] Video readyState stuck at ${currentReadyState} for 1s - possible network/geo-restriction issue`
        );
        return { ready: false, reason: 'readyState_stuck' };
      }
    } else {
      readyStateStuckCount = 0;
    }
    lastReadyState = currentReadyState;

    // Check if we have enough data to render current frame
    // HAVE_CURRENT_DATA (2) = data for current position available
    // HAVE_FUTURE_DATA (3) = data for current + future positions available
    // HAVE_ENOUGH_DATA (4) = can play through without stalling
    if (currentReadyState >= 2) {
      // Verify video has actually buffered this position
      const buffered = videoElement.buffered;
      let isBuffered = false;
      let nearestBufferEnd = 0;
      const hasAnyBuffer = buffered.length > 0;

      for (let i = 0; i < buffered.length; i++) {
        const rangeStart = buffered.start(i);
        const rangeEnd = buffered.end(i);

        // Check if target is within this buffered range
        if (rangeStart <= targetTime && rangeEnd >= targetTime) {
          isBuffered = true;
          break;
        }

        // Track nearest buffer end for diagnostics
        if (rangeEnd > nearestBufferEnd) {
          nearestBufferEnd = rangeEnd;
        }
      }

      if (isBuffered) {
        logger.debug(
          `[SimpleFrameExtractor] Video ready at ${targetTime.toFixed(2)}s (readyState=${currentReadyState}) after ${(performance.now() - startWait).toFixed(0)}ms`
        );
        return { ready: true };
      }

      // Track if buffering is making progress toward our target
      if (hasAnyBuffer) {
        if (nearestBufferEnd === lastBufferCheck && nearestBufferEnd < targetTime) {
          stuckCount++;
          if (stuckCount >= 20) {
            // 20 * 25ms = 500ms stuck
            logger.warn(
              `[SimpleFrameExtractor] Buffering stuck at ${nearestBufferEnd.toFixed(2)}s, target is ${targetTime.toFixed(2)}s (${(targetTime - nearestBufferEnd).toFixed(1)}s away)`
            );
            return { ready: false, reason: 'buffer_not_progressing' };
          }
        } else {
          stuckCount = 0;
        }
        lastBufferCheck = nearestBufferEnd;
      }
    }

    // Adaptive delay based on readyState
    const delay = currentReadyState === 0 ? 100 : currentReadyState === 1 ? 50 : 25;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  logger.warn(
    `[SimpleFrameExtractor] Timeout waiting for video ready at ${targetTime.toFixed(2)}s (readyState=${videoElement.readyState})`
  );

  // After timeout, only proceed if we actually have the data buffered
  const buffered = videoElement.buffered;
  for (let i = 0; i < buffered.length; i++) {
    if (buffered.start(i) <= targetTime && buffered.end(i) >= targetTime) {
      return { ready: true }; // Data is buffered, just took longer than expected
    }
  }

  return { ready: false, reason: 'timeout' };
}

export async function extractFramesSimple(
  videoElement: HTMLVideoElement,
  options: SimpleFrameExtractionOptions,
  onProgress?: (progress: { progress: number; message: string; stage: string }) => void
): Promise<SimpleFrameExtractionResult> {
  const startTime = performance.now();

  try {
    logger.info('[SimpleFrameExtractor] Starting simplified frame extraction');

    // Calculate dimensions - use reasonable defaults while maintaining aspect ratio
    const targetHeight = options.maxHeight || 360; // Default 360px height

    // Note: Quality scaling is already applied by the caller when computing targetWidth/targetHeight
    // Do not apply quality scaling here to avoid double-scaling

    // Lock to target height and scale width proportionally (matches ResolutionScaler behavior)
    // This ensures consistent dimensions across upscaling and downscaling
    const scaleFactor = targetHeight / videoElement.videoHeight;
    let width = Math.round(videoElement.videoWidth * scaleFactor);
    let height = targetHeight;

    // Ensure even dimensions for video encoding (round to nearest even number)
    width = Math.round(width / 2) * 2;
    height = Math.round(height / 2) * 2;

    // Create canvas for frame capture
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (!ctx) {
      throw createError('video', 'Failed to create canvas context');
    }

    const frames: ImageData[] = [];
    const duration = options.endTime - options.startTime;
    // Calculate frame count based on duration and frame rate
    const requestedFrameCount = Math.ceil(duration * options.frameRate);
    const targetFrameCount = requestedFrameCount; // No artificial limit

    logger.info('[SimpleFrameExtractor] Frame count calculated', {
      requestedFrameCount,
      targetFrameCount,
    });
    const captureInterval = duration / targetFrameCount;

    logger.info('[SimpleFrameExtractor] Capture settings', {
      duration,
      targetFrameCount,
      captureInterval,
      dimensions: { width, height },
    });

    // Store original state
    const originalTime = videoElement.currentTime;
    const wasPlaying = !videoElement.paused;

    // Ultra-simple approach: Just capture frames at current position with small increments
    logger.info('[SimpleFrameExtractor] Using ultra-simple instant capture method');

    // Pause video for stable capture
    videoElement.pause();

    // Move to start position if needed
    if (
      videoElement.currentTime < options.startTime ||
      videoElement.currentTime > options.endTime
    ) {
      videoElement.currentTime = options.startTime;
    }

    // Calculate frame times
    const frameInterval = duration / targetFrameCount;

    // Capture frames by incrementing currentTime
    logger.info('[SimpleFrameExtractor] Starting frame capture loop', { targetFrameCount });

    let networkSpeedEstimate: 'fast' | 'medium' | 'slow' = 'fast';
    let totalWaitTime = 0;
    let consecutiveFailures = 0;
    const MAX_TOTAL_WAIT_TIME = 120000; // 2 minutes total across all frames

    for (let i = 0; i < targetFrameCount; i++) {
      const captureTime = options.startTime + i * frameInterval;

      logger.debug(
        `[SimpleFrameExtractor] Setting video time to ${captureTime.toFixed(2)}s for frame ${i + 1}`
      );

      // Set video to capture time
      videoElement.currentTime = Math.min(captureTime, options.endTime);

      // Check if we've exceeded total wait time budget
      if (totalWaitTime > MAX_TOTAL_WAIT_TIME) {
        throw createError(
          'video',
          `Frame capture taking too long (>${(MAX_TOTAL_WAIT_TIME / 1000).toFixed(0)}s total wait). Video may not be loading properly. Try:\n• Waiting for video to buffer more before starting\n• Using a shorter clip\n• Checking your network connection`
        );
      }

      // Wait for video to be ready with buffered data
      const waitStart = performance.now();
      const readyResult = await waitForVideoReady(videoElement, captureTime);
      const waitDuration = performance.now() - waitStart;
      totalWaitTime += waitDuration;

      // Update network speed estimate based on wait times
      if (i > 2) {
        const avgWaitTime = totalWaitTime / (i + 1);
        if (avgWaitTime > 1000) {
          networkSpeedEstimate = 'slow';
        } else if (avgWaitTime > 300) {
          networkSpeedEstimate = 'medium';
        } else {
          networkSpeedEstimate = 'fast';
        }
      }

      if (!readyResult.ready) {
        consecutiveFailures++;
        logger.warn(
          `[SimpleFrameExtractor] Frame ${i + 1} not ready (reason: ${readyResult.reason}, readyState=${videoElement.readyState})`
        );

        // Abort if we have multiple consecutive failures
        if (consecutiveFailures >= 3) {
          const errorMessage =
            readyResult.reason === 'readyState_stuck'
              ? 'Video not loading (possible network issue or geo-restriction)'
              : readyResult.reason === 'buffer_not_progressing'
                ? 'Video buffering stuck. Try waiting for more buffering before creating GIF'
                : 'Video buffering timeout. Network may be too slow';

          throw createError('video', `${errorMessage}. Failed on frame ${i + 1}/${targetFrameCount}`);
        }
      } else {
        consecutiveFailures = 0; // Reset on success
      }

      // Additional delay based on network speed estimate
      let additionalDelay = 0;
      if (networkSpeedEstimate === 'slow') {
        additionalDelay = 200; // Extra time for slow connections
      } else if (networkSpeedEstimate === 'medium') {
        additionalDelay = 100;
      }

      if (additionalDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, additionalDelay));
      }

      // Capture frame
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(videoElement, 0, 0, width, height);

      const imageData = ctx.getImageData(0, 0, width, height);
      frames.push(imageData);

      // Report progress
      if (onProgress) {
        const progress = ((i + 1) / targetFrameCount) * 100;
        onProgress({
          progress,
          message: `Captured ${i + 1}/${targetFrameCount} frames`,
          stage: 'extracting',
        });
      }

      logger.info(
        `[SimpleFrameExtractor] Captured frame ${i + 1}/${targetFrameCount} at ${captureTime.toFixed(2)}s (wait: ${waitDuration.toFixed(0)}ms, speed: ${networkSpeedEstimate})`
      );
    }
    logger.info('[SimpleFrameExtractor] Frame capture loop completed', {
      capturedFrames: frames.length,
      networkSpeedEstimate,
      avgWaitTime: (totalWaitTime / targetFrameCount).toFixed(0) + 'ms',
    });

    // Restore original state
    videoElement.currentTime = originalTime;
    if (wasPlaying) {
      videoElement.play().catch(() => {});
    }

    const processingTime = performance.now() - startTime;

    logger.info('[SimpleFrameExtractor] Extraction complete', {
      framesCaptured: frames.length,
      processingTime,
    });

    return {
      frames,
      metadata: {
        totalFrames: frames.length,
        actualFrameRate: frames.length / duration,
        dimensions: { width, height },
        duration,
        extractionMethod: 'simple-capture',
        processingTime,
      },
    };
  } catch (error) {
    logger.error('[SimpleFrameExtractor] Frame extraction failed', { error });
    throw createError(
      'video',
      `Frame extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
