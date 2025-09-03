/**
 * WebCodecs VideoDecoder utilities and advanced frame processing
 * Provides enhanced video decoding capabilities with hardware acceleration support
 */

export interface VideoDecoderConfig {
  codec: string;
  hardwareAcceleration?: HardwareAcceleration;
  optimizeForLatency?: boolean;
  width?: number;
  height?: number;
}

export interface DecodedVideoFrame {
  frame: VideoFrame;
  timestamp: number;
  duration: number | null;
}

export interface VideoStreamInfo {
  codec: string;
  width: number;
  height: number;
  frameRate: number;
  duration: number;
  bitrate?: number;
}

export interface VideoDecoderOptions {
  hardwareAcceleration?: HardwareAcceleration;
  optimizeForLatency?: boolean;
  maxQueueSize?: number;
}

/**
 * Advanced video decoder using WebCodecs API
 * Optimized for frame extraction performance with hardware acceleration
 */
export class AdvancedVideoDecoder {
  private decoder: VideoDecoder | null = null;
  private isConfigured = false;
  private frameQueue: DecodedVideoFrame[] = [];
  private maxQueueSize: number;
  private frameCallbacks = new Map<number, (frame: DecodedVideoFrame) => void>();
  private errorCallback?: (error: Error) => void;
  private nextFrameId = 0;

  constructor(private options: VideoDecoderOptions = {}) {
    this.maxQueueSize = options.maxQueueSize || 10;
  }

  /**
   * Initialize decoder with video configuration
   */
  async configure(config: VideoDecoderConfig): Promise<void> {
    if (this.decoder) {
      await this.close();
    }

    try {
      this.decoder = new VideoDecoder({
        output: this.handleDecodedFrame.bind(this),
        error: this.handleError.bind(this)
      });

      const decoderConfig: VideoDecoderConfig = {
        ...config,
        hardwareAcceleration: config.hardwareAcceleration || this.options.hardwareAcceleration || 'prefer-hardware',
        optimizeForLatency: config.optimizeForLatency !== undefined ? config.optimizeForLatency : (this.options.optimizeForLatency ?? true)
      };

      this.decoder.configure(decoderConfig);
      this.isConfigured = true;
    } catch (error) {
      throw new Error(`Failed to configure video decoder: ${error}`);
    }
  }

  /**
   * Decode video chunk and return frame
   */
  async decodeFrame(chunk: EncodedVideoChunk): Promise<DecodedVideoFrame> {
    if (!this.decoder || !this.isConfigured) {
      throw new Error('Decoder not configured');
    }

    return new Promise((resolve, reject) => {
      const frameId = this.nextFrameId++;
      
      this.frameCallbacks.set(frameId, resolve);
      this.errorCallback = reject;

      try {
        // Queue decode operation
        this.decoder!.decode(chunk);
        
        // Set timeout for decode operation
        setTimeout(() => {
          if (this.frameCallbacks.has(frameId)) {
            this.frameCallbacks.delete(frameId);
            reject(new Error('Frame decode timeout'));
          }
        }, 5000);
      } catch (error) {
        this.frameCallbacks.delete(frameId);
        reject(error);
      }
    });
  }

  /**
   * Flush pending decode operations
   */
  async flush(): Promise<void> {
    if (!this.decoder) return;
    
    try {
      await this.decoder.flush();
    } catch (error) {
      console.warn('Error during decoder flush:', error);
    }
  }

  /**
   * Close decoder and cleanup resources
   */
  async close(): Promise<void> {
    if (this.decoder) {
      try {
        await this.flush();
        this.decoder.close();
      } catch (error) {
        console.warn('Error during decoder close:', error);
      } finally {
        this.decoder = null;
        this.isConfigured = false;
        this.frameQueue = [];
        this.frameCallbacks.clear();
      }
    }
  }

  /**
   * Get decoder state
   */
  get state(): CodecState | null {
    return this.decoder?.state || null;
  }

  /**
   * Get current decode queue size
   */
  get decodeQueueSize(): number {
    return this.decoder?.decodeQueueSize || 0;
  }

  private handleDecodedFrame(frame: VideoFrame): void {
    const decodedFrame: DecodedVideoFrame = {
      frame,
      timestamp: frame.timestamp || 0,
      duration: frame.duration || null
    };

    // Find waiting callback
    const callback = this.frameCallbacks.values().next().value;
    if (callback) {
      const callbackEntry = Array.from(this.frameCallbacks.entries())[0];
      if (callbackEntry) {
        this.frameCallbacks.delete(callbackEntry[0]);
        callback(decodedFrame);
        return;
      }
    }

    // Add to queue if no callback waiting
    this.frameQueue.push(decodedFrame);
    
    // Manage queue size
    while (this.frameQueue.length > this.maxQueueSize) {
      const oldFrame = this.frameQueue.shift();
      if (oldFrame) {
        oldFrame.frame.close();
      }
    }
  }

  private handleError(error: Error): void {
    console.error('Video decoder error:', error);
    
    if (this.errorCallback) {
      this.errorCallback(error);
      this.errorCallback = undefined;
    }

    // Clear pending callbacks
    this.frameCallbacks.clear();
  }
}

/**
 * Utility functions for video format detection and codec configuration
 */
export class VideoFormatUtils {
  /**
   * Detect video codec from MIME type or container format
   */
  static detectCodec(mimeType: string): string {
    const type = mimeType.toLowerCase();
    
    if (type.includes('h264') || type.includes('avc1')) {
      return 'avc1.42E01E'; // H.264 Baseline Profile
    }
    
    if (type.includes('h265') || type.includes('hevc')) {
      return 'hev1.1.6.L93.B0'; // H.265/HEVC Main Profile
    }
    
    if (type.includes('vp8')) {
      return 'vp8';
    }
    
    if (type.includes('vp9')) {
      return 'vp09.00.10.08'; // VP9 Profile 0
    }
    
    if (type.includes('av01')) {
      return 'av01.0.04M.08'; // AV1 Main Profile
    }
    
    // Default to H.264 if unknown
    return 'avc1.42E01E';
  }

  /**
   * Check if codec is supported for hardware acceleration
   */
  static async checkHardwareSupport(codec: string): Promise<boolean> {
    try {
      const config: VideoDecoderConfig = {
        codec,
        hardwareAcceleration: 'prefer-hardware'
      };
      
      const support = await VideoDecoder.isConfigSupported(config);
      return support.supported === true && support.config?.hardwareAcceleration === 'prefer-hardware';
    } catch {
      return false;
    }
  }

  /**
   * Get optimal decoder configuration for a video
   */
  static async getOptimalConfig(
    videoInfo: VideoStreamInfo,
    options: VideoDecoderOptions = {}
  ): Promise<VideoDecoderConfig> {
    const codec = this.detectCodec(videoInfo.codec);
    const hasHardwareSupport = await this.checkHardwareSupport(codec);
    
    return {
      codec,
      width: videoInfo.width,
      height: videoInfo.height,
      hardwareAcceleration: hasHardwareSupport ? 'prefer-hardware' : 'prefer-software',
      optimizeForLatency: options.optimizeForLatency ?? true
    };
  }

  /**
   * Extract video stream information from video element
   */
  static extractStreamInfo(videoElement: HTMLVideoElement): VideoStreamInfo {
    return {
      codec: 'avc1.42E01E', // Default to H.264, would need media source info for exact codec
      width: videoElement.videoWidth,
      height: videoElement.videoHeight,
      frameRate: 30, // Default, would need container metadata for exact framerate
      duration: videoElement.duration
    };
  }
}

/**
 * Performance monitoring for video decoding operations
 */
export class VideoDecoderPerformanceMonitor {
  private decodeStartTimes = new Map<number, number>();
  private metrics = {
    totalFrames: 0,
    totalDecodeTime: 0,
    maxDecodeTime: 0,
    minDecodeTime: Infinity,
    errors: 0
  };

  startFrameDecode(frameId: number): void {
    this.decodeStartTimes.set(frameId, performance.now());
  }

  endFrameDecode(frameId: number): number {
    const startTime = this.decodeStartTimes.get(frameId);
    if (!startTime) return 0;

    const decodeTime = performance.now() - startTime;
    this.decodeStartTimes.delete(frameId);

    // Update metrics
    this.metrics.totalFrames++;
    this.metrics.totalDecodeTime += decodeTime;
    this.metrics.maxDecodeTime = Math.max(this.metrics.maxDecodeTime, decodeTime);
    this.metrics.minDecodeTime = Math.min(this.metrics.minDecodeTime, decodeTime);

    return decodeTime;
  }

  recordError(): void {
    this.metrics.errors++;
  }

  getMetrics() {
    const avgDecodeTime = this.metrics.totalFrames > 0 ? 
      this.metrics.totalDecodeTime / this.metrics.totalFrames : 0;

    return {
      ...this.metrics,
      averageDecodeTime: avgDecodeTime,
      framesPerSecond: avgDecodeTime > 0 ? 1000 / avgDecodeTime : 0
    };
  }

  reset(): void {
    this.decodeStartTimes.clear();
    this.metrics = {
      totalFrames: 0,
      totalDecodeTime: 0,
      maxDecodeTime: 0,
      minDecodeTime: Infinity,
      errors: 0
    };
  }
}

/**
 * High-level interface for WebCodecs frame extraction
 */
export class WebCodecsFrameExtractor {
  private decoder: AdvancedVideoDecoder;
  private performanceMonitor: VideoDecoderPerformanceMonitor;

  constructor(options: VideoDecoderOptions = {}) {
    this.decoder = new AdvancedVideoDecoder(options);
    this.performanceMonitor = new VideoDecoderPerformanceMonitor();
  }

  /**
   * Extract frames using WebCodecs decoder (for encoded video streams)
   */
  async extractFramesFromStream(
    chunks: EncodedVideoChunk[],
    config: VideoDecoderConfig
  ): Promise<VideoFrame[]> {
    await this.decoder.configure(config);
    
    const frames: VideoFrame[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      try {
        this.performanceMonitor.startFrameDecode(i);
        const decodedFrame = await this.decoder.decodeFrame(chunk);
        const decodeTime = this.performanceMonitor.endFrameDecode(i);
        
        frames.push(decodedFrame.frame);
        
        // Log performance warning if decode takes too long
        if (decodeTime > 100) {
          console.warn(`Frame decode took ${decodeTime.toFixed(2)}ms (target: <100ms)`);
        }
      } catch (error) {
        this.performanceMonitor.recordError();
        console.error(`Failed to decode frame ${i}:`, error);
      }
    }

    await this.decoder.close();
    return frames;
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return this.performanceMonitor.getMetrics();
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.decoder.close();
    this.performanceMonitor.reset();
  }
}

/**
 * Utility function to check WebCodecs support with specific features
 */
export async function checkWebCodecsSupport(): Promise<{
  supported: boolean;
  hardwareAcceleration: boolean;
  supportedCodecs: string[];
}> {
  if (!('VideoDecoder' in window)) {
    return {
      supported: false,
      hardwareAcceleration: false,
      supportedCodecs: []
    };
  }

  const commonCodecs = [
    'avc1.42E01E', // H.264 Baseline
    'avc1.4D401E', // H.264 Main
    'vp8',
    'vp09.00.10.08', // VP9
    'av01.0.04M.08'  // AV1
  ];

  const supportedCodecs: string[] = [];
  let hasHardwareAcceleration = false;

  for (const codec of commonCodecs) {
    try {
      const config: VideoDecoderConfig = { codec };
      const support = await VideoDecoder.isConfigSupported(config);
      
      if (support.supported) {
        supportedCodecs.push(codec);
      }

      if (!hasHardwareAcceleration) {
        const hwConfig: VideoDecoderConfig = {
          codec,
          hardwareAcceleration: 'prefer-hardware'
        };
        const hwSupport = await VideoDecoder.isConfigSupported(hwConfig);
        if (hwSupport.supported) {
          hasHardwareAcceleration = true;
        }
      }
    } catch {
      // Codec not supported
    }
  }

  return {
    supported: true,
    hardwareAcceleration: hasHardwareAcceleration,
    supportedCodecs
  };
}