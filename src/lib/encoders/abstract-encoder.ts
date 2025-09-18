/**
 * Abstract encoder interface for GIF and other format encoders
 * Provides a unified API for different encoding libraries
 */

export interface EncodingProgress {
  stage: 'preparing' | 'encoding' | 'finalizing' | 'completed';
  frameIndex?: number;
  totalFrames: number;
  percentage: number;
  estimatedTimeRemaining?: number;
  currentOperation?: string;
  memoryUsage?: number;
}

export interface EncodingResult {
  blob: Blob;
  metadata: {
    width: number;
    height: number;
    frameCount: number;
    fileSize: number;
    encodingTime: number;
    averageFrameTime: number;
    format: 'gif' | 'mp4';
    encoder: string;
  };
  performance: {
    success: boolean;
    efficiency: number;
    recommendations: string[];
    peakMemoryUsage: number;
  };
}

export interface EncodingOptions {
  width: number;
  height: number;
  frameRate: number;
  quality: 'low' | 'medium' | 'high' | number;
  loop: boolean;
  dithering?: boolean;
  optimizeColors?: boolean;
  backgroundColor?: string;
}

export interface FrameData {
  imageData: ImageData;
  timestamp: number;
  delay?: number;
}

export abstract class AbstractEncoder {
  protected isEncoding = false;
  protected abortController: AbortController | null = null;
  protected progressCallback?: (progress: EncodingProgress) => void;
  protected startTime = 0;
  protected frameCount = 0;

  /**
   * Check if the encoder is available in the current environment
   */
  abstract isAvailable(): boolean;

  /**
   * Initialize the encoder with any required libraries or setup
   */
  abstract initialize(): Promise<void>;

  /**
   * Encode frames into the target format
   */
  abstract encode(
    frames: FrameData[],
    options: EncodingOptions,
    onProgress?: (progress: EncodingProgress) => void,
    abortSignal?: AbortSignal
  ): Promise<EncodingResult>;

  /**
   * Cancel ongoing encoding operation
   */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.cleanup();
  }

  /**
   * Get current encoding status
   */
  get status() {
    return {
      isEncoding: this.isEncoding,
      canCancel: this.isEncoding && this.abortController !== null
    };
  }

  /**
   * Get encoder name for identification
   */
  abstract get name(): string;

  /**
   * Get supported formats
   */
  abstract get supportedFormats(): Array<'gif' | 'mp4'>;

  /**
   * Get performance characteristics
   */
  abstract get characteristics(): {
    speed: 'fast' | 'medium' | 'slow';
    quality: 'low' | 'medium' | 'high';
    memoryUsage: 'low' | 'medium' | 'high';
    browserSupport: 'excellent' | 'good' | 'limited';
  };

  protected reportProgress(
    stage: EncodingProgress['stage'],
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
  }

  protected getCurrentMemoryUsage(): number | undefined {
    if ('memory' in performance) {
      const memInfo = (performance as Performance & { memory?: { usedJSHeapSize?: number } }).memory;
      return memInfo?.usedJSHeapSize;
    }
    return undefined;
  }

  protected cleanup(): void {
    this.isEncoding = false;
    this.progressCallback = undefined;
    this.abortController = null;
  }
}