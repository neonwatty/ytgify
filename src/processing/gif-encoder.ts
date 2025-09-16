/**
 * GIF encoding implementation using gif.js library
 * Optimized for Chrome extension usage with progress tracking and performance monitoring
 */

import { GifSettings, GifData, TimelineSelection } from '@/types';
import { ExtractedFrame, FrameExtractionResult } from './frame-extractor';
import { 
  GifEncodingOptions, 
  GifFrameOptions, 
  EncodingOptimizer, 
  EncodingProfiler,
  GifQualityPreset 
} from './encoding-options';
import { performanceTracker } from '@/monitoring/performance-tracker';
import { metricsCollector } from '@/monitoring/metrics-collector';

// gif.js type definitions (since @types/gif.js doesn't exist)
interface GIFConstructor {
  new (options?: Partial<GifEncodingOptions>): GIFInstance;
}

declare global {
  interface Window {
    GIF: GIFConstructor;
  }
}

interface GIFInstance {
  addFrame(
    element: HTMLCanvasElement | HTMLImageElement | CanvasRenderingContext2D | ImageData,
    options?: Partial<GifFrameOptions>
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
    data: ImageData;
    delay: number;
  }>;
  
  options: GifEncodingOptions;
}

export interface GifEncodingProgress {
  stage: 'preparing' | 'encoding' | 'finalizing';
  frameIndex?: number;
  totalFrames: number;
  percentage: number;
  estimatedTimeRemaining?: number;
  currentOperation?: string;
  memoryUsage?: number;
}

export interface GifEncodingResult {
  blob: Blob;
  metadata: {
    width: number;
    height: number;
    frameCount: number;
    fileSize: number;
    encodingTime: number;
    averageFrameTime: number;
    preset: GifQualityPreset;
    options: GifEncodingOptions;
  };
  performance: {
    success: boolean;
    efficiency: number;
    recommendations: string[];
    peakMemoryUsage: number;
  };
}

export interface GifEncodingConfig {
  settings: GifSettings;
  preset?: GifQualityPreset;
  customOptions?: Partial<GifEncodingOptions>;
  onProgress?: (progress: GifEncodingProgress) => void;
  abortSignal?: AbortSignal;
}

/**
 * High-performance GIF encoder with optimizations for Chrome extension usage
 */
export class GifEncoder {
  private gifInstance: GIFInstance | null = null;
  private isEncoding = false;
  private abortController: AbortController | null = null;
  private abortSignalCleanup?: () => void;
  private profiler: EncodingProfiler;
  private progressCallback?: (progress: GifEncodingProgress) => void;
  private startTime = 0;
  private frameCount = 0;
  private currentStage: GifEncodingProgress['stage'] = 'preparing';
  private encodingTimeout?: NodeJS.Timeout;

  constructor() {
    this.profiler = new EncodingProfiler();
  }

  /**
   * Public alias matching legacy API used by tests and callers
   */
  async encodeFrames(
    frames: ExtractedFrame[] | FrameExtractionResult,
    config: GifEncodingConfig
  ): Promise<GifEncodingResult> {
    return this.encodeGif(frames, config);
  }

  /**
   * Check if encoder is actively processing frames
   */
  isCurrentlyEncoding(): boolean {
    return this.isEncoding;
  }

  /**
   * Check if gif.js library is loaded and available
   */
  static isAvailable(): boolean {
    return typeof window !== 'undefined' && 'GIF' in window;
  }

  /**
   * Load gif.js library dynamically if not already loaded
   */
  static async ensureLoaded(): Promise<void> {
    if (this.isAvailable()) return;

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('vendor/gif.js');
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load gif.js library'));
      document.head.appendChild(script);
    });
  }

  /**
   * Encode frames into GIF with optimized settings
   */
  async encodeGif(
    frames: ExtractedFrame[] | FrameExtractionResult,
    config: GifEncodingConfig
  ): Promise<GifEncodingResult> {
    if (this.isEncoding) {
      throw new Error('Already encoding');
    }

    // Ensure gif.js is loaded when running outside test environment
    if (!GifEncoder.isAvailable()) {
      await GifEncoder.ensureLoaded();
    }

    this.isEncoding = true;
    this.progressCallback = config.onProgress;
    this.abortController = new AbortController();
    this.startTime = performance.now();
    const profiler = this.profiler as any;

    if (config.abortSignal) {
      if (config.abortSignal.aborted) {
        this.cleanup();
        throw new Error('Encoding aborted');
      }

      const abortHandler = () => {
        if (!this.abortController?.signal.aborted) {
          this.abortController?.abort();
        }
        this.cancel();
      };

      config.abortSignal.addEventListener('abort', abortHandler);
      this.abortSignalCleanup = () => {
        config.abortSignal?.removeEventListener('abort', abortHandler);
      };
    }

    // Start performance monitoring
    const encodingSessionId = `gif-encoding-${Date.now()}`;
    metricsCollector.startOperation?.(encodingSessionId);
    metricsCollector.recordUserAction?.('gif-encoding-started', {
      frameCount: Array.isArray(frames) ? frames.length : frames.frames.length,
      settings: config.settings
    });

    // Handle both frame arrays and extraction results
    const frameArray = Array.isArray(frames) ? frames : frames.frames;
    const metadata = Array.isArray(frames) ? undefined : frames.metadata;
    
    this.frameCount = frameArray.length;

    if (this.frameCount === 0) {
      this.abortSignalCleanup?.();
      this.abortSignalCleanup = undefined;
      this.cleanup();
      throw new Error('No frames provided');
    }

    const tracker = performanceTracker as unknown as {
      startTimer?: (id: string) => void;
      endTimer?: (
        id: string,
        category: string,
        metadata?: Record<string, unknown>
      ) => number;
      recordMemoryUsage?: () => Promise<void>;
    };

    try {
      // Start profiling
      profiler.start?.();

      // Create encoding options
      const options = this.createEncodingOptions(config, metadata);
      
      // Validate options
      const optimizerValidation = (EncodingOptimizer as unknown as {
        validateOptions?: (
          options: GifEncodingOptions,
          frameCount: number
        ) => { valid: boolean; warnings: string[]; adjustedOptions?: GifEncodingOptions };
      }).validateOptions?.(options, this.frameCount);

      if (optimizerValidation?.valid === false) {
        console.warn('Encoding options validation warnings:', optimizerValidation.warnings);
        if (optimizerValidation.adjustedOptions) {
          Object.assign(options, optimizerValidation.adjustedOptions);
        }
      }

      // Initialize GIF encoder
      this.gifInstance = new window.GIF(options);
      this.setupEventHandlers();

      // Report initial progress
      this.reportProgress('preparing', 0);

      // Monitor frame addition phase
      tracker.startTimer?.(`${encodingSessionId}-frame-addition`);
      
      // Add frames to encoder
      this.addFramesToEncoder(frameArray, config.settings);
      
      const frameAdditionTime = tracker.endTimer?.(
        `${encodingSessionId}-frame-addition`,
        'encoding',
        { phase: 'frame-addition', frameCount: frameArray.length }
      ) ?? 0;
      metricsCollector.trackEncodingPhase?.('palette', frameAdditionTime, {
        frameCount: frameArray.length
      });

      // Start encoding
      this.currentStage = 'encoding';
      this.reportProgress('encoding', 0);
       
      // Monitor encoding phase
      tracker.startTimer?.(`${encodingSessionId}-encoding`);
       
      if (!this.gifInstance) {
        throw new Error('GIF instance not initialized');
      }

      const encodingPromise = new Promise<Blob>((resolve, reject) => {
        this.encodingTimeout = setTimeout(() => {
          reject(new Error('Encoding timeout'));
        }, this.gifInstance!.options.timeLimit || 30000);

        this.gifInstance!.on('finished', (blob: Blob) => {
          if (this.encodingTimeout) {
            clearTimeout(this.encodingTimeout);
            this.encodingTimeout = undefined;
          }
          resolve(blob);
        });

        this.gifInstance!.on('abort', () => {
          if (this.encodingTimeout) {
            clearTimeout(this.encodingTimeout);
            this.encodingTimeout = undefined;
          }
          reject(new Error('Encoding aborted'));
        });
      });

      this.gifInstance.running = true;
      this.gifInstance.render();

      const result = await encodingPromise;
       
      const encodingTime = tracker.endTimer?.(
        `${encodingSessionId}-encoding`,
        'encoding',
        { phase: 'encoding' }
      ) ?? 0;
      metricsCollector.trackEncodingPhase?.('encoding', encodingTime);
       
      // Finalize
      this.currentStage = 'finalizing';
      this.reportProgress('finalizing', 95);
       
      // Monitor finalization
      tracker.startTimer?.(`${encodingSessionId}-finalization`);

      const finalResult = this.createResult(result, options, config);
       
      const finalizationTime = tracker.endTimer?.(
        `${encodingSessionId}-finalization`,
        'encoding',
        { phase: 'finalization', outputSize: result.size }
      ) ?? 0;
      metricsCollector.trackEncodingPhase?.('optimization', finalizationTime, {
        outputSize: result.size
      });
      
      this.reportProgress('finalizing', 100);
      
      // Complete monitoring session
      const totalTime = metricsCollector.endOperation?.(encodingSessionId, 'encoding', {
        frameCount: frameArray.length,
        outputSize: result.size,
        dimensions: `${options.width || 'auto'}x${options.height || 'auto'}`
      });
      
      // Track successful GIF creation
      metricsCollector.incrementGifCount?.();
      metricsCollector.recordUserAction?.('gif-encoding-completed', {
        totalTime,
        frameCount: frameArray.length,
        outputSize: result.size
      });

      return finalResult;
      
    } catch (error) {
      profiler.recordError?.();
      
      // Record error in metrics
      metricsCollector.recordError?.({
        type: 'gif-encoding-error',
        message: error instanceof Error ? error.message : 'Unknown encoding error',
        context: {
          frameCount: this.frameCount,
          stage: this.currentStage
        }
      });
      if (error instanceof Error) {
        throw error;
      }
      throw error;
    } finally {
      // Record memory usage after encoding
      if (typeof tracker.recordMemoryUsage === 'function') {
        await tracker.recordMemoryUsage();
      } else if (typeof (performanceTracker as any).recordMemoryUsage === 'function') {
        await (performanceTracker as any).recordMemoryUsage();
      }
      this.abortSignalCleanup?.();
      this.abortSignalCleanup = undefined;
      this.cleanup();
    }
  }

  /**
   * Cancel ongoing encoding operation
   */
  cancel(): void {
    if (this.abortController && !this.abortController.signal.aborted) {
      this.abortController.abort();
    }
    
    if (this.gifInstance && this.gifInstance.running) {
      this.gifInstance.abort();
    }
  }

  /**
   * Get current encoding status
   */
  get status(): {
    isEncoding: boolean;
    stage: string;
    progress: number;
  } {
    return {
      isEncoding: this.isEncoding,
      stage: this.currentStage,
      progress: this.calculateCurrentProgress()
    };
  }

  private createEncodingOptions(
    config: GifEncodingConfig,
    metadata?: FrameExtractionResult['metadata']
  ): GifEncodingOptions {
    const optimizer = EncodingOptimizer as unknown as {
      createOptionsFromSettings?: (
        settings: GifSettings,
        preset?: GifQualityPreset,
        analysis?: FrameExtractionResult['metadata']
      ) => GifEncodingOptions;
    };

    const baseOptions = (optimizer.createOptionsFromSettings?.(
      config.settings,
      config.preset
    ) ?? this.buildFallbackOptions(config.settings, config.preset)) as GifEncodingOptions &
      Record<string, unknown>;

    // Apply custom overrides
    if (config.customOptions) {
      Object.assign(baseOptions, config.customOptions);
    }

    if (config.customOptions?.background) {
      baseOptions.transparent = baseOptions.transparent ?? true;
    }

    // Use metadata dimensions if available
    if (metadata) {
      baseOptions.width = metadata.width;
      baseOptions.height = metadata.height;
    }

    return baseOptions;
  }

  private buildFallbackOptions(
    settings: GifSettings,
    preset?: GifQualityPreset
  ): GifEncodingOptions & Record<string, unknown> {
    const optimizer = EncodingOptimizer as unknown as {
      getRecommendedSettings?: (
        settings: GifSettings,
        preset?: GifQualityPreset
      ) => Partial<GifEncodingOptions> & { workerScript?: string; transparent?: boolean };
    };

    const recommended = optimizer.getRecommendedSettings?.(settings, preset) ?? {};
    const [width, height] = settings.resolution.includes('x')
      ? settings.resolution.split('x').map(num => parseInt(num.trim(), 10))
      : [640, 480];

    const qualityFromSettings =
      settings.quality === 'high' ? 5 : settings.quality === 'low' ? 20 : 10;

    const options: GifEncodingOptions & Record<string, unknown> = {
      workers: recommended.workers ?? 2,
      quality: recommended.quality ?? qualityFromSettings,
      repeat: recommended.repeat ?? 0,
      background: recommended.background,
      debug: recommended.debug ?? false,
      dither: recommended.dither ?? false,
      globalPalette: recommended.globalPalette ?? false,
      workerScript: recommended.workerScript,
      progressInterval: recommended.progressInterval ?? 50,
      memoryLimit: recommended.memoryLimit ?? 80 * 1024 * 1024,
      timeLimit: recommended.timeLimit ?? 10000,
      width,
      height
    };

    if (recommended.transparent !== undefined) {
      options.transparent = recommended.transparent;
    }

    return options;
  }

  private setupEventHandlers(): void {
    if (!this.gifInstance) return;

    this.gifInstance.on('start', () => {
      
    });

    this.gifInstance.on('progress', (progress: number) => {
      const percentage = Math.round(progress * 100);
      this.reportProgress('encoding', percentage);
      this.profiler.recordMemoryUsage();
    });

    this.gifInstance.on('abort', () => {
      
    });

    // Monitor for abort signal
    if (this.abortController) {
      this.abortController.signal.addEventListener('abort', () => {
        if (this.gifInstance && this.gifInstance.running) {
          this.gifInstance.abort();
        }
      });
    }
  }

  private addFramesToEncoder(
    frames: ExtractedFrame[],
    settings: GifSettings
  ): void {
    if (!this.gifInstance) {
      throw new Error('GIF instance not initialized');
    }

    const optimizer = EncodingOptimizer as unknown as {
      calculateFrameDelay?: (frameRate: number) => number;
    };
    const frameDelay =
      optimizer.calculateFrameDelay?.(settings.frameRate) ??
      Math.max(1, Math.round(100 / Math.max(1, settings.frameRate)));
    const requiresCanvasProcessing =
      settings.brightness !== 1 ||
      settings.contrast !== 1 ||
      Boolean(settings.textOverlays && settings.textOverlays.length > 0);
    const profiler = this.profiler as any;

    for (let i = 0; i < frames.length; i++) {
      if (this.abortController?.signal.aborted) {
        throw new Error('Encoding aborted');
      }

      profiler.startFrame?.(i);
      
      const frame = frames[i];
      
      let frameSource:
        | HTMLCanvasElement
        | HTMLImageElement
        | CanvasRenderingContext2D
        | ImageData = frame.imageData;

      if (requiresCanvasProcessing) {
        const canvas = document.createElement('canvas');
        canvas.width = frame.imageData.width;
        canvas.height = frame.imageData.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Failed to get canvas context');
        }

        ctx.putImageData(frame.imageData, 0, 0);
        this.applyFrameProcessing(ctx, settings);
        frameSource = canvas;
      }

      // Add frame to GIF
      this.gifInstance.addFrame(frameSource, {
        delay: frameDelay,
        dispose: 2 // Restore to background
      });
      
      const frameTime = profiler.endFrame?.(i) ?? 0;

      // Report progress
      const progress = Math.round((i / frames.length) * 30); // Preparing is 0-30%
      this.reportProgress('preparing', progress, `Processing frame ${i + 1}/${frames.length}`);
      
      // Performance warning
      if (frameTime > 50) {
        console.warn(`Frame ${i} processing took ${frameTime.toFixed(2)}ms`);
      }
      
      // Yield control periodically
    }
  }

  private applyFrameProcessing(
    ctx: CanvasRenderingContext2D,
    settings: GifSettings
  ): void {
    const canvas = ctx.canvas;
    
    // Apply brightness and contrast adjustments
    if (settings.brightness !== 1 || settings.contrast !== 1) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      const brightness = (settings.brightness - 1) * 255;
      const contrast = settings.contrast;
      
      for (let i = 0; i < data.length; i += 4) {
        // Apply brightness
        data[i] = Math.max(0, Math.min(255, data[i] + brightness)); // Red
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + brightness)); // Green
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + brightness)); // Blue
        
        // Apply contrast
        data[i] = Math.max(0, Math.min(255, (data[i] - 128) * contrast + 128));
        data[i + 1] = Math.max(0, Math.min(255, (data[i + 1] - 128) * contrast + 128));
        data[i + 2] = Math.max(0, Math.min(255, (data[i + 2] - 128) * contrast + 128));
      }
      
      ctx.putImageData(imageData, 0, 0);
    }
    
    // Add text overlays if specified
    if (settings.textOverlays && settings.textOverlays.length > 0) {
      settings.textOverlays.forEach(overlay => {
        ctx.save();
        ctx.font = `${overlay.fontSize}px ${overlay.fontFamily}`;
        ctx.fillStyle = overlay.color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        
        // Add text stroke for better visibility
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = 2;
        ctx.strokeText(overlay.text, overlay.position.x, overlay.position.y);
        ctx.fillText(overlay.text, overlay.position.x, overlay.position.y);
        
        ctx.restore();
      });
    }
  }

  private createResult(
    blob: Blob,
    options: GifEncodingOptions,
    config: GifEncodingConfig
  ): GifEncodingResult {
    const encodingTime = performance.now() - this.startTime;
    const profiler = this.profiler as any;
    const performanceResult =
      profiler.finish?.(this.frameCount) ?? this.buildFallbackPerformance(encodingTime);

    return {
      blob,
      metadata: {
        width: options.width || 640,
        height: options.height || 480,
        frameCount: this.frameCount,
        fileSize: blob.size,
        encodingTime,
        averageFrameTime: performanceResult.avgFrameTime,
        preset: config.preset || 'balanced',
        options
      },
      performance: performanceResult
    };
  }

  private buildFallbackPerformance(encodingTime: number): {
    success: boolean;
    efficiency: number;
    recommendations: string[];
    peakMemoryUsage: number;
    avgFrameTime: number;
  } {
    const avgFrameTime = this.frameCount > 0 ? encodingTime / this.frameCount : 0;

    return {
      success: true,
      efficiency: 1,
      recommendations: [],
      peakMemoryUsage: this.getCurrentMemoryUsage() ?? 0,
      avgFrameTime
    };
  }

  private reportProgress(
    stage: GifEncodingProgress['stage'],
    percentage: number,
    operation?: string
  ): void {
    if (!this.progressCallback) return;

    const elapsedTime = performance.now() - this.startTime;
    const estimatedTotalTime = percentage > 0 ? (elapsedTime / percentage) * 100 : 0;
    const estimatedTimeRemaining = Math.max(0, estimatedTotalTime - elapsedTime);

    this.progressCallback({
      stage,
      frameIndex: stage === 'preparing' ? Math.floor((percentage / 30) * this.frameCount) : undefined,
      totalFrames: this.frameCount,
      percentage: Math.max(0, Math.min(100, percentage)),
      estimatedTimeRemaining: estimatedTimeRemaining > 0 ? estimatedTimeRemaining : undefined,
      currentOperation: operation,
      memoryUsage: this.getCurrentMemoryUsage()
    });

    (this.profiler as any).recordMemoryUsage?.();
  }

  private calculateCurrentProgress(): number {
    switch (this.currentStage) {
      case 'preparing':
        return 0;
      case 'encoding':
        return 30;
      case 'finalizing':
        return 95;
      default:
        return 0;
    }
  }

  private getCurrentMemoryUsage(): number | undefined {
    if ('memory' in performance) {
      const memInfo = (performance as unknown as { memory: { usedJSHeapSize: number } }).memory;
      return memInfo.usedJSHeapSize;
    }
    return undefined;
  }

  private cleanup(): void {
    this.isEncoding = false;
    this.progressCallback = undefined;
    this.abortController = null;
    this.abortSignalCleanup = undefined;
    this.currentStage = 'preparing';
    if (this.encodingTimeout) {
      clearTimeout(this.encodingTimeout);
      this.encodingTimeout = undefined;
    }
    
    if (this.gifInstance) {
      this.gifInstance = null;
    }
  }
}

/**
 * Convenience function for encoding GIFs with default settings
 */
export async function encodeGif(
  frames: ExtractedFrame[] | FrameExtractionResult,
  settings: GifSettings,
  options?: {
    preset?: GifQualityPreset;
    onProgress?: (progress: GifEncodingProgress) => void;
    abortSignal?: AbortSignal;
  }
): Promise<GifEncodingResult> {
  const encoder = new GifEncoder();
  return encoder.encodeGif(frames, {
    settings,
    preset: options?.preset,
    onProgress: options?.onProgress,
    abortSignal: options?.abortSignal
  });
}

/**
 * Create GIF data object from encoding result and metadata
 */
export function createGifData(
  result: GifEncodingResult,
  selection: TimelineSelection,
  title: string,
  youtubeUrl?: string
): GifData {
  return {
    id: crypto.randomUUID(),
    title,
    description: `GIF created from ${selection.startTime.toFixed(1)}s - ${selection.endTime.toFixed(1)}s`,
    blob: result.blob,
    metadata: {
      width: result.metadata.width,
      height: result.metadata.height,
      duration: selection.duration,
      frameRate: result.metadata.frameCount / selection.duration,
      fileSize: result.metadata.fileSize,
      createdAt: new Date(),
      youtubeUrl,
      startTime: selection.startTime,
      endTime: selection.endTime
    },
    tags: []
  };
}

/**
 * Estimate encoding parameters for performance planning
 */
export function estimateEncodingParameters(
  settings: GifSettings,
  preset: GifQualityPreset = 'balanced'
): {
  estimatedFileSize: string;
  estimatedEncodingTime: string;
  memoryUsage: string;
  frameCount: number;
  recommendations: string[];
} {
  const duration = settings.endTime - settings.startTime;
  const frameCount = Math.ceil(duration * settings.frameRate);
  
  const [width, height] = settings.resolution.includes('x') 
    ? settings.resolution.split('x').map(n => parseInt(n.trim()))
    : [640, 480];

  // Get preset options for estimation
  const options = EncodingOptimizer.createOptionsFromSettings(settings, preset);
  const memoryUsage = EncodingOptimizer.estimateMemoryUsage(frameCount, width, height, options);
  
  // Rough file size estimation (highly variable)
  const estimatedBytesPerFrame = (width * height * 0.1); // Very rough compression estimate
  const estimatedFileSize = frameCount * estimatedBytesPerFrame;
  
  // Rough encoding time estimation
  const complexityFactor = frameCount / 100;
  const qualityFactor = (30 - options.quality) / 15;
  const estimatedTime = complexityFactor * qualityFactor * 2000; // Base: 2 seconds per 100 frames
  
  const recommendations: string[] = [];
  
  if (frameCount > 200) {
    recommendations.push('Consider reducing duration or frame rate for faster encoding');
  }
  
  if (estimatedFileSize > 5 * 1024 * 1024) {
    recommendations.push('Large file size expected, consider lower resolution or quality');
  }
  
  if (estimatedTime > 10000) {
    recommendations.push('Long encoding time expected, consider "fast-encode" preset');
  }

  return {
    estimatedFileSize: `${(estimatedFileSize / 1024 / 1024).toFixed(1)}MB`,
    estimatedEncodingTime: `${(estimatedTime / 1000).toFixed(1)}s`,
    memoryUsage: `${(memoryUsage / 1024 / 1024).toFixed(1)}MB`,
    frameCount,
    recommendations
  };
}
