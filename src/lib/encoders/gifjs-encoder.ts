/**
 * gif.js encoder adapter - maintains backward compatibility
 * Legacy encoder with good browser support
 */

import {
  AbstractEncoder,
  EncodingOptions,
  EncodingResult,
  EncodingProgress,
  FrameData,
} from './abstract-encoder';

// gif.js type definitions

interface GIFJsInstance {
  addFrame(
    element: HTMLCanvasElement | HTMLImageElement | CanvasRenderingContext2D | ImageData,
    options?: { delay?: number; copy?: boolean; dispose?: number; localPalette?: boolean }
  ): void;

  render(): void;
  abort(): void;

  on(event: 'start', callback: () => void): void;
  on(event: 'abort', callback: () => void): void;
  on(event: 'progress', callback: (progress: number) => void): void;
  on(event: 'finished', callback: (blob: Blob) => void): void;
  on(event: 'workerReady', callback: (worker: Worker) => void): void;

  running: boolean;
  frames: Array<{
    frame: ImageData | CanvasRenderingContext2D | HTMLImageElement | HTMLCanvasElement;
    delay?: number;
    copy?: boolean;
    transparent?: number | string;
    dispose?: number;
  }>;
  options: Record<string, unknown>;
}

// Use existing global GIF type from processing/gif-encoder.ts

export class GifJsEncoder extends AbstractEncoder {
  private gifInstance: GIFJsInstance | null = null;
  private canvas: OffscreenCanvas | null = null;
  private ctx: OffscreenCanvasRenderingContext2D | null = null;
  // Reusable regular canvas for gif.js compatibility
  private regularCanvas: HTMLCanvasElement | null = null;
  private regularCtx: CanvasRenderingContext2D | null = null;

  get name(): string {
    return 'gif.js';
  }

  get supportedFormats(): Array<'gif' | 'mp4'> {
    return ['gif'];
  }

  get characteristics() {
    return {
      speed: 'medium' as const,
      quality: 'medium' as const,
      memoryUsage: 'high' as const,
      browserSupport: 'excellent' as const,
    };
  }

  isAvailable(): boolean {
    // gif.js requires DOM access (document, window) - not available in service workers
    return typeof window !== 'undefined' && typeof document !== 'undefined' && 'GIF' in window;
  }

  async initialize(): Promise<void> {
    // Check if we're in a service worker context (no DOM)
    if (typeof document === 'undefined') {
      throw new Error('gif.js encoder requires DOM access and cannot run in service worker context');
    }

    if (this.isAvailable()) return;

    // Dynamically load gif.js if not available
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('vendor/gif.js');
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load gif.js library'));
      document.head.appendChild(script);
    });
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

    // Ensure we have DOM access before proceeding
    if (typeof document === 'undefined') {
      throw new Error('gif.js encoder requires DOM access and cannot run in service worker context');
    }

    // Ensure OffscreenCanvas is available (lazy check)
    if (typeof OffscreenCanvas === 'undefined') {
      throw new Error('OffscreenCanvas not available in this environment');
    }

    await this.initialize();

    this.isEncoding = true;
    this.progressCallback = onProgress;
    this.abortController = null;
    this.startTime = performance.now();
    this.frameCount = frames.length;

    // Lazy create offscreen canvas for frame processing (only when encode is called)
    this.canvas = new OffscreenCanvas(options.width, options.height);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to create 2D canvas context');
    }
    this.ctx = ctx;

    // Lazy create reusable regular canvas for gif.js compatibility (only when encode is called)
    this.regularCanvas = document.createElement('canvas');
    this.regularCanvas.width = options.width;
    this.regularCanvas.height = options.height;
    const regularCtx = this.regularCanvas.getContext('2d');
    if (!regularCtx) {
      throw new Error('Failed to create regular 2D canvas context');
    }
    this.regularCtx = regularCtx;

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
    this.reportProgress('preparing', 0, 'Initializing gif.js');

    // Convert quality setting to gif.js format
    const quality = this.mapQualityToGifJs(options.quality);

    // Get worker script URL for Chrome extension context
    const workerScript =
      typeof chrome !== 'undefined' && chrome.runtime?.getURL
        ? chrome.runtime.getURL('gif.worker.js')
        : '/gif.worker.js';

    // Initialize gif.js instance (cast to our interface)
    this.gifInstance = new (
      window as unknown as { GIF: new (options: Record<string, unknown>) => GIFJsInstance }
    ).GIF({
      width: options.width,
      height: options.height,
      quality: quality,
      workers: 2,
      workerScript: workerScript,
      repeat: options.loop ? 0 : -1, // 0 = loop forever, -1 = no loop
      dither: 'Stucki-serpentine', // Stucki-serpentine for highest quality dithering
      debug: false,
      background: options.backgroundColor || undefined,
    });

    // Set up event handlers
    this.setupEventHandlers(abortSignal);

    this.reportProgress('preparing', 10, 'Adding frames');

    // Calculate frame delay
    const baseFrameDelay = Math.round(1000 / options.frameRate);

    // Add frames to gif.js
    for (let i = 0; i < frames.length; i++) {
      if (abortSignal?.aborted) {
        throw new Error('Encoding aborted');
      }

      const frame = frames[i];
      const frameDelay = frame.delay !== undefined ? frame.delay : baseFrameDelay;

      // Put ImageData onto offscreen canvas
      this.ctx!.putImageData(frame.imageData, 0, 0);

      // Reuse regular canvas for gif.js compatibility
      // Clear the canvas before drawing new frame
      this.regularCtx!.clearRect(0, 0, this.regularCanvas!.width, this.regularCanvas!.height);
      this.regularCtx!.drawImage(this.canvas!, 0, 0);

      this.gifInstance!.addFrame(this.regularCtx!, {
        copy: true,
        delay: frameDelay,
        dispose: 2, // Restore to background
        localPalette: true, // Each frame gets optimized 256-color palette
      });

      // Report progress for adding frames
      if (i % Math.ceil(frames.length / 20) === 0) {
        const progress = 10 + Math.round((i / frames.length) * 20);
        this.reportProgress('preparing', progress, `Added frame ${i + 1}/${frames.length}`);
      }
    }

    this.reportProgress('encoding', 30, 'Starting GIF encoding');

    // Start encoding and wait for completion
    const blob = await this.renderGif();

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
        format: 'gif',
        encoder: this.name,
      },
      performance: {
        success: true,
        efficiency: this.calculateEfficiency(encodingTime, frames.length),
        recommendations: this.generateRecommendations(options, frames.length, encodingTime),
        peakMemoryUsage: this.getCurrentMemoryUsage() || 0,
      },
    };
  }

  private setupEventHandlers(abortSignal?: AbortSignal): void {
    if (!this.gifInstance) return;

    this.gifInstance.on('start', () => {});

    this.gifInstance.on('progress', (progress: number) => {
      const percentage = 30 + Math.round(progress * 60); // Encoding is 30-90%
      this.reportProgress('encoding', percentage, `Encoding: ${Math.round(progress * 100)}%`);
    });

    this.gifInstance.on('abort', () => {});

    // Monitor for abort signal
    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        if (this.gifInstance && this.gifInstance.running) {
          this.gifInstance.abort();
        }
      });
    }
  }

  private renderGif(): Promise<Blob> {
    return new Promise<Blob>((resolve, reject) => {
      if (!this.gifInstance) {
        reject(new Error('GIF instance not initialized'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('GIF encoding timeout'));
      }, 60000); // 60 second timeout

      this.gifInstance.on('finished', (blob: Blob) => {
        clearTimeout(timeout);
        resolve(blob);
      });

      this.gifInstance.on('abort', () => {
        clearTimeout(timeout);
        reject(new Error('GIF encoding aborted'));
      });

      // Start the rendering process
      this.gifInstance.render();
    });
  }

  private mapQualityToGifJs(quality: 'low' | 'medium' | 'high' | number): number {
    if (typeof quality === 'number') return quality;

    switch (quality) {
      case 'low':
        return 10; // Improved from 20
      case 'medium':
        return 5; // Improved from 10
      case 'high':
        return 1; // Improved from 5 - maximum quality
      default:
        return 5;
    }
  }

  private calculateEfficiency(encodingTime: number, frameCount: number): number {
    const timePerFrame = encodingTime / frameCount;
    // gif.js is generally slower, so adjust expectations
    // Above 20 fps = excellent (1.0), below 5 fps = poor (0.3)
    const fps = 1000 / timePerFrame;
    return Math.max(0.3, Math.min(1.0, fps / 20));
  }

  private generateRecommendations(
    options: EncodingOptions,
    frameCount: number,
    encodingTime: number
  ): string[] {
    const recommendations: string[] = [];
    const timePerFrame = encodingTime / frameCount;

    if (timePerFrame > 200) {
      recommendations.push('Consider using gifenc encoder for better performance');
    }

    if (frameCount > 150) {
      recommendations.push('Large frame count with gif.js - consider reducing or using gifenc');
    }

    if (options.width * options.height > 800 * 600) {
      recommendations.push('High resolution with gif.js may be slow - consider gifenc encoder');
    }

    if (encodingTime > 30000) {
      recommendations.push('Long encoding time detected - try gifenc encoder for 2x performance');
    }

    return recommendations;
  }

  protected cleanup(): void {
    super.cleanup();
    this.gifInstance = null;
    this.canvas = null;
    this.ctx = null;
    this.regularCanvas = null;
    this.regularCtx = null;
  }
}
