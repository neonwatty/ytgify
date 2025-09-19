/**
 * gifenc encoder implementation - high-performance GIF encoder
 * Often 2x faster than gif.js with similar quality
 */

import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import {
  AbstractEncoder,
  EncodingOptions,
  EncodingResult,
  EncodingProgress,
  FrameData,
} from './abstract-encoder';

export class GifencEncoder extends AbstractEncoder {
  private encoder: GIFEncoder | null = null;

  get name(): string {
    return 'gifenc';
  }

  get supportedFormats(): Array<'gif' | 'mp4'> {
    return ['gif'];
  }

  get characteristics() {
    return {
      speed: 'fast' as const,
      quality: 'high' as const,
      memoryUsage: 'medium' as const,
      browserSupport: 'excellent' as const,
    };
  }

  isAvailable(): boolean {
    try {
      // Try to import gifenc functions
      return typeof quantize === 'function' && typeof GIFEncoder === 'function';
    } catch {
      return false;
    }
  }

  async initialize(): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('gifenc library is not available');
    }
    // gifenc doesn't need initialization
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
      return await this.performEncoding(frames, options);
    } finally {
      this.cleanup();
    }
  }

  private async performEncoding(
    frames: FrameData[],
    options: EncodingOptions
  ): Promise<EncodingResult> {
    this.reportProgress('preparing', 0, 'Initializing encoder');

    const frameDelay = Math.round(1000 / options.frameRate); // Convert to milliseconds
    console.log('[GifencEncoder] frameRate:', options.frameRate, 'frameDelay:', frameDelay, 'ms');

    // Create GIFEncoder instance
    this.encoder = new GIFEncoder();

    this.reportProgress('preparing', 10, 'Processing frames');

    // Decision: Use global palette for smaller file size and consistency
    // Alternative: per-frame palettes for better quality but larger files
    const useGlobalPalette = true;
    let globalPalette: number[][] | null = null;

    if (useGlobalPalette && frames.length > 0) {
      // Sample multiple frames for better color representation
      const samplesToTake = Math.min(5, frames.length); // Sample up to 5 frames
      const sampleInterval = Math.max(1, Math.floor(frames.length / samplesToTake));

      // Collect pixel data from sampled frames
      const sampledPixelArrays: Uint8ClampedArray[] = [];
      let totalPixels = 0;

      for (let i = 0; i < frames.length; i += sampleInterval) {
        if (sampledPixelArrays.length >= samplesToTake) break;
        const frameData = frames[i].imageData.data;
        sampledPixelArrays.push(frameData);
        totalPixels += frameData.length;
      }

      // Combine all sampled pixel data into a single array for quantization
      const combinedPixels = new Uint8ClampedArray(totalPixels);
      let offset = 0;
      for (const pixels of sampledPixelArrays) {
        combinedPixels.set(pixels, offset);
        offset += pixels.length;
      }

      // Generate global palette from combined samples
      console.log(`[GifencEncoder] Generating palette from ${sampledPixelArrays.length} sampled frames`);
      globalPalette = quantize(combinedPixels, 256, {
        format: 'rgb444',
        clearAlpha: false
      });
    }

    // Process each frame
    for (let i = 0; i < frames.length; i++) {
      if (this.abortController?.signal.aborted) {
        throw new Error('Encoding cancelled');
      }

      const frame = frames[i];
      const customDelay = frame.delay !== undefined ? frame.delay : frameDelay;

      // Get the pixel data
      const pixels = frame.imageData.data;

      let palette: number[][];
      let indices: Uint8Array;

      if (useGlobalPalette && globalPalette) {
        // Use the global palette
        palette = globalPalette;
        indices = applyPalette(pixels, palette, 'rgb444');
      } else {
        // Generate per-frame palette
        palette = quantize(pixels, 256, {
          format: 'rgb444',
          clearAlpha: false
        });
        indices = applyPalette(pixels, palette, 'rgb444');
      }

      // Write frame to encoder
      this.encoder.writeFrame(indices, options.width, options.height, {
        palette: palette,
        delay: customDelay,
        dispose: 2, // Clear to background color
        first: i === 0,
        repeat: i === 0 ? (options.loop ? 0 : -1) : undefined
      });

      const progress = 10 + Math.round((i / frames.length) * 80);
      this.reportProgress('encoding', progress, `Encoding frame ${i + 1}/${frames.length}`);

      // Yield control periodically
      if (i % 10 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    this.reportProgress('finalizing', 90, 'Finalizing GIF');

    // Finish writing the GIF (adds trailer)
    this.encoder.finish();

    // Get the complete GIF data
    const gifData = this.encoder.bytes();
    // Ensure we have a proper ArrayBuffer-backed Uint8Array
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
        efficiency: Math.min(1, 5000 / encodingTime), // Efficiency based on encoding speed
        recommendations: encodingTime > 5000
          ? ['Consider reducing frame count or resolution for faster encoding']
          : [],
        peakMemoryUsage: frames.length * options.width * options.height * 4, // Rough estimate
      },
    };
  }

  protected cleanup(): void {
    super.cleanup();
    this.encoder = null;
  }

  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.cleanup();
  }
}