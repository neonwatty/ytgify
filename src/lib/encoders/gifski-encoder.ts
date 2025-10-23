/**
 * gifski-wasm encoder implementation - highest quality GIF encoder
 * Uses advanced temporal dithering and cross-frame palette optimization
 */

import encode from 'gifski-wasm';
import {
  AbstractEncoder,
  EncodingOptions,
  EncodingResult,
  EncodingProgress,
  FrameData,
} from './abstract-encoder';

export class GifskiEncoder extends AbstractEncoder {
  get name(): string {
    return 'gifski';
  }

  get supportedFormats(): Array<'gif' | 'mp4'> {
    return ['gif'];
  }

  get characteristics() {
    return {
      speed: 'slow' as const,
      quality: 'high' as const,
      memoryUsage: 'high' as const,
      browserSupport: 'good' as const,
    };
  }

  isAvailable(): boolean {
    try {
      // Check if gifski-wasm encode function is available
      return typeof encode === 'function';
    } catch {
      return false;
    }
  }

  async initialize(): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('gifski-wasm library is not available');
    }
    // gifski-wasm doesn't need explicit initialization
    // WASM is loaded automatically on first use
  }

  async encode(
    frames: FrameData[],
    options: EncodingOptions,
    onProgress?: (progress: EncodingProgress) => void,
    abortSignal?: AbortSignal
  ): Promise<EncodingResult> {
    if (this.isEncoding) {
      throw new Error('Encoding already in progress');
    }

    this.isEncoding = true;
    this.progressCallback = onProgress;
    this.abortController = abortSignal ? new AbortController() : null;
    this.startTime = performance.now();
    this.frameCount = frames.length;

    try {
      return await this.performEncoding(frames, options, abortSignal);
    } finally {
      this.cleanup();
    }
  }

  private async performEncoding(
    frames: FrameData[],
    options: EncodingOptions,
    abortSignal?: AbortSignal
  ): Promise<EncodingResult> {
    this.reportProgress('preparing', 0, 'Initializing gifski encoder');

    if (abortSignal?.aborted) {
      throw new Error('Encoding cancelled');
    }

    // Convert frames to ImageData array (gifski expects this format)
    const imageDataFrames: ImageData[] = frames.map((frame) => frame.imageData);

    this.reportProgress('preparing', 20, 'Preparing frames for encoding');

    // Map quality to gifski settings
    // gifski uses a 'fast' option where true = faster but lower quality
    const qualitySettings = this.mapQualityToGifski(options.quality);

    this.reportProgress('encoding', 30, 'Encoding GIF with gifski');

    // Encode using gifski-wasm
    const gifData = await encode({
      frames: imageDataFrames,
      fps: options.frameRate,
      width: options.width,
      height: options.height,
      ...qualitySettings,
    });

    if (abortSignal?.aborted) {
      throw new Error('Encoding cancelled');
    }

    this.reportProgress('finalizing', 90, 'Finalizing GIF');

    // Convert Uint8Array to Blob (ensure it's a standard Uint8Array)
    const gifBuffer = new Uint8Array(gifData);
    const blob = new Blob([gifBuffer], { type: 'image/gif' });
    const encodingTime = performance.now() - this.startTime;

    this.reportProgress('completed', 100, 'Encoding complete');

    return {
      blob,
      metadata: {
        width: options.width,
        height: options.height,
        frameCount: frames.length,
        fileSize: blob.size,
        encodingTime,
        averageFrameTime: encodingTime / frames.length,
        format: 'gif' as const,
        encoder: this.name,
      },
      performance: {
        success: true,
        efficiency: Math.min(1, 10000 / encodingTime), // gifski is slower but higher quality
        recommendations: encodingTime > 10000
          ? ['gifski provides highest quality but is slower - encoding time is expected']
          : [],
        peakMemoryUsage: frames.length * options.width * options.height * 4,
      },
    };
  }

  private mapQualityToGifski(
    quality: 'low' | 'medium' | 'high' | number
  ): { quality?: number } {
    if (typeof quality === 'number') {
      // If numeric quality provided, map to gifski quality (1-100)
      return { quality: Math.min(100, Math.max(1, quality)) };
    }

    switch (quality) {
      case 'low':
        return { quality: 80 };
      case 'medium':
        return { quality: 90 };
      case 'high':
        return { quality: 100 }; // Maximum quality
      default:
        return { quality: 90 };
    }
  }

  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.cleanup();
  }
}
