// GIF encoder utility using gif.js library
import { logger } from './logger';
import { createError } from './errors';
import GIF from 'gif.js';

export interface GifEncodingOptions {
  width: number;
  height: number;
  frameRate: number;
  quality: 'low' | 'medium' | 'high';
  loop: boolean;
  dithering?: boolean;
  optimizeColors?: boolean;
  backgroundColor?: string;
}

export interface GifEncodingProgress {
  stage: 'analyzing' | 'quantizing' | 'encoding' | 'optimizing' | 'completed';
  progress: number;
  message: string;
}

export interface EncodedGifResult {
  gifBlob: Blob;
  thumbnailBlob?: Blob;
  metadata: {
    fileSize: number;
    duration: number;
    width: number;
    height: number;
    frameCount: number;
    colorCount?: number;
    compressionRatio?: number;
  };
}

export class GifEncoder {
  private options: GifEncodingOptions;
  private canvas: OffscreenCanvas;
  private ctx: OffscreenCanvasRenderingContext2D;
  private onProgress?: (progress: GifEncodingProgress) => void;
  private gif!: GIF; // gif.js instance - initialized in encode()

  constructor(options: GifEncodingOptions, onProgress?: (progress: GifEncodingProgress) => void) {
    this.options = options;
    this.onProgress = onProgress;
    
    // Create offscreen canvas for frame processing
    this.canvas = new OffscreenCanvas(options.width, options.height);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw createError('gif', 'Failed to create 2D canvas context');
    }
    this.ctx = ctx;

    logger.info('[GifEncoder] Initialized with gif.js', { 
      width: options.width, 
      height: options.height, 
      quality: options.quality 
    });
  }

  // Main encoding method
  public async encodeFrames(frames: ImageData[]): Promise<EncodedGifResult> {
    if (frames.length === 0) {
      throw createError('gif', 'No frames provided for encoding');
    }

    logger.info('[GifEncoder] Starting GIF encoding with gif.js', { 
      frameCount: frames.length, 
      options: this.options 
    });

    try {
      return new Promise((resolve, reject) => {
        // Configure quality based on option
        let quality: number;
        switch (this.options.quality) {
          case 'low': quality = 20; break;
          case 'medium': quality = 10; break;
          case 'high': quality = 5; break;
          default: quality = 10;
        }

        // Create gif.js instance
        // Use chrome.runtime.getURL for extension context
        const workerScript = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL 
          ? chrome.runtime.getURL('gif.worker.js')
          : '/gif.worker.js';
        
        this.gif = new GIF({
          width: this.options.width,
          height: this.options.height,
          quality: quality,
          workers: 2,
          workerScript: workerScript,
          repeat: this.options.loop ? 0 : -1, // 0 = loop forever, -1 = no loop
          dither: this.options.dithering,
          debug: false
        });

        // Add progress event listener
        this.gif.on('progress', (progress: number) => {
          const stage = progress < 0.3 ? 'analyzing' : 
                       progress < 0.6 ? 'encoding' : 
                       progress < 0.9 ? 'optimizing' : 'optimizing';
          const percentage = Math.round(progress * 100);
          this.reportProgress(stage as GifEncodingProgress['stage'], percentage, `Processing: ${percentage}%`);
        });

        // Add finished event listener
        this.gif.on('finished', async (blob: Blob) => {
          try {
            // Create thumbnail from first frame
            const thumbnailBlob = await this.createThumbnail(frames[0]);
            
            this.reportProgress('completed', 100, 'Encoding completed');

            const result: EncodedGifResult = {
              gifBlob: blob,
              thumbnailBlob,
              metadata: {
                fileSize: blob.size,
                duration: frames.length / this.options.frameRate,
                width: this.options.width,
                height: this.options.height,
                frameCount: frames.length,
                colorCount: undefined, // gif.js doesn't provide this
                compressionRatio: undefined // gif.js doesn't provide this
              }
            };

            logger.info('[GifEncoder] Encoding completed successfully', { 
              fileSize: result.metadata.fileSize,
              frameCount: frames.length
            });

            resolve(result);
          } catch (error) {
            reject(error);
          }
        });

        // Add error event listener
        this.gif.on('error', (error: Error) => {
          logger.error('[GifEncoder] gif.js error', { error });
          reject(createError('gif', `GIF encoding failed: ${error.message}`));
        });

        // Calculate delay between frames (in milliseconds)
        const frameDelay = Math.round(1000 / this.options.frameRate);

        // Add frames to gif.js
        this.reportProgress('analyzing', 5, 'Preparing frames for encoding');
        
        frames.forEach((frame, index) => {
          // Put ImageData onto canvas
          this.ctx.putImageData(frame, 0, 0);
          
          // Add canvas frame to GIF
          this.gif.addFrame(this.canvas as unknown as HTMLCanvasElement, {
            copy: true,
            delay: frameDelay
          });

          // Report progress for adding frames
          if (index % Math.ceil(frames.length / 10) === 0) {
            const progress = Math.round((index / frames.length) * 20) + 5;
            this.reportProgress('analyzing', progress, `Added ${index + 1}/${frames.length} frames`);
          }
        });

        // Start rendering
        this.reportProgress('encoding', 25, 'Starting GIF encoding');
        this.gif.render();
      });

    } catch (error) {
      logger.error('[GifEncoder] Encoding failed', { error, frameCount: frames.length });
      throw createError('gif', `GIF encoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Create thumbnail from first frame
  private async createThumbnail(firstFrame: ImageData): Promise<Blob> {
    const thumbnailSize = 150; // 150x150 thumbnail
    const thumbnailCanvas = new OffscreenCanvas(thumbnailSize, thumbnailSize);
    const thumbnailCtx = thumbnailCanvas.getContext('2d');
    
    if (!thumbnailCtx) {
      throw createError('gif', 'Failed to create thumbnail canvas context');
    }

    // Draw and scale the first frame
    const tempCanvas = new OffscreenCanvas(firstFrame.width, firstFrame.height);
    const tempCtx = tempCanvas.getContext('2d');
    
    if (tempCtx) {
      tempCtx.putImageData(firstFrame, 0, 0);
      
      // Scale to thumbnail size while maintaining aspect ratio
      const scale = Math.min(thumbnailSize / firstFrame.width, thumbnailSize / firstFrame.height);
      const scaledWidth = firstFrame.width * scale;
      const scaledHeight = firstFrame.height * scale;
      const offsetX = (thumbnailSize - scaledWidth) / 2;
      const offsetY = (thumbnailSize - scaledHeight) / 2;
      
      thumbnailCtx.drawImage(tempCanvas, offsetX, offsetY, scaledWidth, scaledHeight);
    }

    return thumbnailCanvas.convertToBlob({ type: 'image/png', quality: 0.8 });
  }

  // Utility methods

  private reportProgress(stage: GifEncodingProgress['stage'], progress: number, message: string): void {
    if (this.onProgress) {
      this.onProgress({ stage, progress, message });
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export utility function for easy integration
export async function encodeGif(
  frames: ImageData[], 
  options: GifEncodingOptions,
  onProgress?: (progress: GifEncodingProgress) => void
): Promise<EncodedGifResult> {
  const encoder = new GifEncoder(options, onProgress);
  return encoder.encodeFrames(frames);
}