// Instant frame capture - captures frames immediately without any seeking
import { logger } from './logger';
import { createError } from './errors';

export interface InstantCaptureOptions {
  frameCount?: number;
  width?: number;
  height?: number;
}

export async function captureInstantFrames(
  videoElement: HTMLVideoElement,
  startTime: number,
  endTime: number,
  options: InstantCaptureOptions = {}
): Promise<ImageData[]> {
  const {
    frameCount = 10, // Default to 10 frames for quick capture
    width = 480,
    height = 360,
  } = options;

  logger.info('[InstantCapture] Starting instant frame capture', {
    startTime,
    endTime,
    frameCount,
    currentTime: videoElement.currentTime,
  });

  const frames: ImageData[] = [];

  try {
    // Create canvas
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (!ctx) {
      throw createError('video', 'Failed to create canvas context');
    }

    // Calculate actual dimensions maintaining aspect ratio
    const aspectRatio = videoElement.videoWidth / videoElement.videoHeight;
    let actualWidth = width;
    let actualHeight = height;

    if (actualWidth / actualHeight > aspectRatio) {
      actualWidth = actualHeight * aspectRatio;
    } else {
      actualHeight = actualWidth / aspectRatio;
    }

    actualWidth = Math.floor(actualWidth / 2) * 2;
    actualHeight = Math.floor(actualHeight / 2) * 2;

    // Resize canvas to actual dimensions
    canvas.width = actualWidth;
    canvas.height = actualHeight;

    // Pause video for stable capture
    const wasPlaying = !videoElement.paused;
    videoElement.pause();

    // Store original time
    const originalTime = videoElement.currentTime;

    // If video is outside range, move to start
    if (videoElement.currentTime < startTime || videoElement.currentTime > endTime) {
      videoElement.currentTime = startTime;
      // Wait briefly for seek
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    // Capture frames with minimal seeking
    const duration = endTime - startTime;
    const interval = duration / frameCount;

    for (let i = 0; i < frameCount; i++) {
      const targetTime = startTime + i * interval;

      // Only seek if we're capturing multiple frames
      if (i > 0) {
        videoElement.currentTime = Math.min(targetTime, endTime);
        // Very short wait - just enough for frame to update
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // Capture current frame
      ctx.clearRect(0, 0, actualWidth, actualHeight);
      ctx.drawImage(videoElement, 0, 0, actualWidth, actualHeight);

      const imageData = ctx.getImageData(0, 0, actualWidth, actualHeight);
      frames.push(imageData);

      logger.debug(`[InstantCapture] Captured frame ${i + 1}/${frameCount}`);

      // If we got at least 5 frames and it's taking too long, stop
      if (frames.length >= 5 && i > 10) {
        logger.warn('[InstantCapture] Stopping early with partial frames');
        break;
      }
    }

    // Restore video state
    videoElement.currentTime = originalTime;
    if (wasPlaying) {
      videoElement.play().catch(() => {});
    }

    logger.info(`[InstantCapture] Captured ${frames.length} frames successfully`);

    // If we didn't get enough frames, duplicate what we have
    while (frames.length < 5) {
      frames.push(frames[frames.length - 1]);
    }

    return frames;
  } catch (error) {
    logger.error('[InstantCapture] Frame capture failed', { error });

    // Emergency fallback: return at least one frame
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (ctx) {
      ctx.drawImage(videoElement, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      return [imageData, imageData, imageData]; // Return 3 copies for minimal GIF
    }

    throw error;
  }
}
