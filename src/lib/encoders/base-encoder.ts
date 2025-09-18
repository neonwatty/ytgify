// Base encoder interface for GIF encoding implementations
export interface FrameData {
  data: Uint8ClampedArray | ImageData;
  width: number;
  height: number;
  delay?: number; // milliseconds
}

export interface EncoderOptions {
  width: number;
  height: number;
  quality?: 'low' | 'medium' | 'high';
  frameRate?: number;
  loop?: number; // 0 = loop forever
  transparent?: boolean;
  background?: string;
  debug?: boolean;
}

interface EncoderResult {
  blob: Blob;
  size?: number;
  frameCount?: number;
  duration?: number; // total duration in ms
  metadata?: {
    format?: string;
    width?: number;
    height?: number;
    frames?: number;
    duration?: number;
    quality?: number;
  };
}

interface EncoderProgress {
  percent: number;
  message: string;
  currentFrame?: number;
  totalFrames?: number;
}

type ProgressCallback = (progress: EncoderProgress) => void;

// Abstract base class for GIF encoders
export abstract class BaseEncoder {
  protected options: EncoderOptions;
  
  constructor(options: EncoderOptions) {
    this.options = {
      quality: 'medium',
      frameRate: 10,
      loop: 0,
      transparent: false,
      debug: false,
      ...options
    };
  }
  
  // Main encoding method - must be implemented by subclasses
  abstract encode(
    frames: FrameData[],
    onProgress?: ProgressCallback
  ): Promise<EncoderResult>;
  
  // Helper method to calculate quality value
  protected getQualityValue(): number {
    switch (this.options.quality) {
      case 'low': return 20;
      case 'high': return 5;
      case 'medium':
      default: return 10;
    }
  }
  
  // Helper to calculate frame delay from frame rate
  protected getFrameDelay(): number {
    return Math.round(1000 / (this.options.frameRate || 10));
  }
  
  // Helper to create result object
  protected createResult(blob: Blob, frameCount: number): EncoderResult {
    const frameDelay = this.getFrameDelay();
    return {
      blob,
      size: blob.size,
      frameCount,
      duration: frameCount * frameDelay
    };
  }
}