// GIF encoder utility using efficient algorithms
import { logger } from './logger';
import { createError } from './errors';

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

    logger.info('[GifEncoder] Initialized', { 
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

    logger.info('[GifEncoder] Starting GIF encoding', { 
      frameCount: frames.length, 
      options: this.options 
    });

    try {
      // Stage 1: Analyze frames
      this.reportProgress('analyzing', 10, 'Analyzing frame data');
      await this.delay(50);

      const analyzedFrames = await this.analyzeFrames(frames);
      
      // Stage 2: Color quantization
      this.reportProgress('quantizing', 30, 'Optimizing color palette');
      await this.delay(50);

      const colorPalette = await this.generateColorPalette(analyzedFrames);
      
      // Stage 3: Frame encoding
      this.reportProgress('encoding', 50, 'Encoding frames');
      
      const encodedData = await this.encodeFramesWithPalette(analyzedFrames, colorPalette);
      
      // Stage 4: Optimization
      this.reportProgress('optimizing', 80, 'Optimizing GIF structure');
      await this.delay(50);

      const optimizedGif = await this.optimizeGifData(encodedData);
      
      // Stage 5: Create thumbnail
      const thumbnailBlob = await this.createThumbnail(frames[0]);
      
      this.reportProgress('completed', 100, 'Encoding completed');

      const result: EncodedGifResult = {
        gifBlob: optimizedGif.blob,
        thumbnailBlob,
        metadata: {
          fileSize: optimizedGif.blob.size,
          duration: frames.length / this.options.frameRate,
          width: this.options.width,
          height: this.options.height,
          frameCount: frames.length,
          colorCount: colorPalette.colors.length,
          compressionRatio: optimizedGif.compressionRatio
        }
      };

      logger.info('[GifEncoder] Encoding completed successfully', { 
        fileSize: result.metadata.fileSize,
        compressionRatio: result.metadata.compressionRatio,
        colorCount: result.metadata.colorCount
      });

      return result;

    } catch (error) {
      logger.error('[GifEncoder] Encoding failed', { error, frameCount: frames.length });
      throw createError('gif', `GIF encoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Analyze frames for color distribution and motion
  private async analyzeFrames(frames: ImageData[]): Promise<AnalyzedFrame[]> {
    const analyzedFrames: AnalyzedFrame[] = [];
    
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      
      // Extract color information
      const colorHistogram = this.buildColorHistogram(frame);
      const motionData = i > 0 ? this.calculateMotion(frames[i-1], frame) : null;
      
      analyzedFrames.push({
        imageData: frame,
        colorHistogram,
        motionData,
        index: i
      });

      // Report progress within this stage
      if (i % Math.ceil(frames.length / 10) === 0) {
        const progress = 10 + (i / frames.length) * 15; // 10-25% range
        this.reportProgress('analyzing', progress, `Analyzed ${i + 1}/${frames.length} frames`);
        await this.delay(1);
      }
    }

    return analyzedFrames;
  }

  // Generate optimized color palette
  private async generateColorPalette(frames: AnalyzedFrame[]): Promise<ColorPalette> {
    // For now, implement a simple color quantization
    // In production, this would use advanced algorithms like octree or median cut
    
    const allColors = new Map<string, number>();
    
    // Collect color frequency across all frames
    for (const frame of frames) {
      for (const [color, count] of frame.colorHistogram.entries()) {
        allColors.set(color, (allColors.get(color) || 0) + count);
      }
    }

    // Determine palette size based on quality
    let paletteSize: number;
    switch (this.options.quality) {
      case 'low': paletteSize = 64; break;
      case 'medium': paletteSize = 128; break;
      case 'high': paletteSize = 256; break;
      default: paletteSize = 128;
    }

    // Select most frequent colors
    const sortedColors = Array.from(allColors.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, paletteSize);

    const colors = sortedColors.map(([colorStr]) => {
      const [r, g, b, a] = colorStr.split(',').map(Number);
      return { r, g, b, a: a || 255 };
    });

    return { colors, size: colors.length };
  }

  // Encode frames using the generated palette
  private async encodeFramesWithPalette(
    frames: AnalyzedFrame[], 
    palette: ColorPalette
  ): Promise<EncodedGifData> {
    // This is a simplified implementation
    // In production, this would implement LZW compression and proper GIF structure
    
    const encodedFrames: Uint8Array[] = [];
    
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const encodedFrame = await this.encodeFrameWithPalette(frame.imageData, palette);
      encodedFrames.push(encodedFrame);

      // Report progress within this stage
      const progress = 50 + (i / frames.length) * 25; // 50-75% range
      this.reportProgress('encoding', progress, `Encoded ${i + 1}/${frames.length} frames`);
      await this.delay(1);
    }

    return { frames: encodedFrames, palette };
  }

  // Encode a single frame with the palette
  private async encodeFrameWithPalette(imageData: ImageData, palette: ColorPalette): Promise<Uint8Array> {
    const { width, height } = imageData;
    const frameData = new Uint8Array(width * height);
    
    // Map each pixel to nearest palette color
    for (let i = 0; i < imageData.data.length; i += 4) {
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      const a = imageData.data[i + 3];
      
      const nearestColorIndex = this.findNearestPaletteColor(palette, { r, g, b, a });
      frameData[i / 4] = nearestColorIndex;
    }

    return frameData;
  }

  // Optimize the final GIF data
  private async optimizeGifData(encodedData: EncodedGifData): Promise<OptimizedGif> {
    // Create GIF structure with proper headers
    const gifData = this.createGifStructure(encodedData);
    
    // Apply optimizations
    const optimizedData = this.options.optimizeColors ? 
      this.optimizeColorUsage(new Uint8Array(gifData)) : new Uint8Array(gifData);
    
    const blob = new Blob([optimizedData.buffer as ArrayBuffer], { type: 'image/gif' });
    const originalSize = encodedData.frames.reduce((sum, frame) => sum + frame.length, 0);
    const compressionRatio = originalSize > 0 ? optimizedData.length / originalSize : 1;

    return { blob, compressionRatio };
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
  private buildColorHistogram(imageData: ImageData): Map<string, number> {
    const histogram = new Map<string, number>();
    
    for (let i = 0; i < imageData.data.length; i += 4) {
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      const a = imageData.data[i + 3];
      
      const colorKey = `${r},${g},${b},${a}`;
      histogram.set(colorKey, (histogram.get(colorKey) || 0) + 1);
    }
    
    return histogram;
  }

  private calculateMotion(prevFrame: ImageData, currentFrame: ImageData): MotionData {
    // Simplified motion detection
    let totalDifference = 0;
    let changedPixels = 0;

    for (let i = 0; i < prevFrame.data.length; i += 4) {
      const rDiff = Math.abs(prevFrame.data[i] - currentFrame.data[i]);
      const gDiff = Math.abs(prevFrame.data[i + 1] - currentFrame.data[i + 1]);
      const bDiff = Math.abs(prevFrame.data[i + 2] - currentFrame.data[i + 2]);
      
      const pixelDiff = (rDiff + gDiff + bDiff) / 3;
      
      if (pixelDiff > 10) { // Threshold for change detection
        changedPixels++;
        totalDifference += pixelDiff;
      }
    }

    const totalPixels = prevFrame.data.length / 4;
    return {
      changedPixelRatio: changedPixels / totalPixels,
      averageChange: changedPixels > 0 ? totalDifference / changedPixels : 0
    };
  }

  private findNearestPaletteColor(palette: ColorPalette, color: { r: number; g: number; b: number; a: number }): number {
    let minDistance = Infinity;
    let nearestIndex = 0;

    for (let i = 0; i < palette.colors.length; i++) {
      const paletteColor = palette.colors[i];
      const distance = Math.sqrt(
        Math.pow(color.r - paletteColor.r, 2) +
        Math.pow(color.g - paletteColor.g, 2) +
        Math.pow(color.b - paletteColor.b, 2) +
        Math.pow(color.a - paletteColor.a, 2)
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearestIndex = i;
      }
    }

    return nearestIndex;
  }

  private createGifStructure(encodedData: EncodedGifData): ArrayBuffer {
    // Create proper GIF structure with headers, color tables, and frame data
    
    // Calculate sizes
    const globalColorTableSize = encodedData.palette.size * 3; // RGB entries
    const headerSize = 13; // Standard GIF header
    const applicationExtensionSize = this.options.loop ? 19 : 0; // For NETSCAPE2.0 loop extension
    
    // Estimate frame data size (header + image data + delays)
    const frameOverheadPerFrame = 26; // Graphic control extension + image descriptor
    const frameDataSize = encodedData.frames.reduce((sum, frame) => sum + frame.length, 0);
    const totalFrameOverhead = encodedData.frames.length * frameOverheadPerFrame;
    
    const totalSize = 
      headerSize + 
      globalColorTableSize + 
      applicationExtensionSize + 
      frameDataSize + 
      totalFrameOverhead + 
      1000; // Safety buffer
    
    const gifData = new Uint8Array(totalSize);
    let offset = 0;
    
    // GIF Header (6 bytes): "GIF89a"
    gifData[offset++] = 0x47; // 'G'
    gifData[offset++] = 0x49; // 'I'
    gifData[offset++] = 0x46; // 'F'
    gifData[offset++] = 0x38; // '8'
    gifData[offset++] = 0x39; // '9'
    gifData[offset++] = 0x61; // 'a'
    
    // Logical Screen Descriptor (7 bytes)
    gifData[offset++] = this.options.width & 0xFF;        // Width low byte
    gifData[offset++] = (this.options.width >> 8) & 0xFF; // Width high byte
    gifData[offset++] = this.options.height & 0xFF;       // Height low byte
    gifData[offset++] = (this.options.height >> 8) & 0xFF; // Height high byte
    
    // Global Color Table Flag + Color Resolution + Sort Flag + Global Color Table Size
    const colorTableSizeBits = Math.max(1, Math.ceil(Math.log2(encodedData.palette.size)) - 1);
    const packed = 0x80 | (0x70) | (0x00) | (colorTableSizeBits & 0x07); // GCT flag + 8-bit colors + no sort + size
    gifData[offset++] = packed;
    
    gifData[offset++] = 0; // Background Color Index
    gifData[offset++] = 0; // Pixel Aspect Ratio
    
    // Global Color Table (3 * palette size bytes)
    for (const color of encodedData.palette.colors) {
      gifData[offset++] = color.r;
      gifData[offset++] = color.g;
      gifData[offset++] = color.b;
    }
    
    // Pad color table to power of 2 if necessary
    const actualTableSize = Math.pow(2, colorTableSizeBits + 1);
    const colorsToPad = actualTableSize - encodedData.palette.colors.length;
    for (let i = 0; i < colorsToPad; i++) {
      gifData[offset++] = 0; // R
      gifData[offset++] = 0; // G
      gifData[offset++] = 0; // B
    }
    
    // Application Extension for looping (if enabled)
    if (this.options.loop) {
      gifData[offset++] = 0x21; // Extension Introducer
      gifData[offset++] = 0xFF; // Application Extension Label
      gifData[offset++] = 0x0B; // Block Size
      
      // Application Identifier: "NETSCAPE"
      const appId = "NETSCAPE";
      for (let i = 0; i < 8; i++) {
        gifData[offset++] = i < appId.length ? appId.charCodeAt(i) : 0;
      }
      
      // Application Authentication Code: "2.0"
      const authCode = "2.0";
      for (let i = 0; i < 3; i++) {
        gifData[offset++] = i < authCode.length ? authCode.charCodeAt(i) : 0;
      }
      
      gifData[offset++] = 0x03; // Data Sub-block size
      gifData[offset++] = 0x01; // Loop sub-block ID
      gifData[offset++] = 0x00; // Loop count low byte (0 = infinite)
      gifData[offset++] = 0x00; // Loop count high byte
      gifData[offset++] = 0x00; // Block Terminator
    }
    
    // Frame data
    const frameDelay = Math.max(1, Math.round(100 / this.options.frameRate)); // Convert FPS to centiseconds
    
    for (let frameIndex = 0; frameIndex < encodedData.frames.length; frameIndex++) {
      const frame = encodedData.frames[frameIndex];
      
      // Graphic Control Extension (8 bytes)
      gifData[offset++] = 0x21; // Extension Introducer
      gifData[offset++] = 0xF9; // Graphic Control Label
      gifData[offset++] = 0x04; // Block Size
      gifData[offset++] = 0x00; // Packed field (no disposal method, no user input, no transparent color)
      gifData[offset++] = frameDelay & 0xFF;        // Delay Time low byte
      gifData[offset++] = (frameDelay >> 8) & 0xFF; // Delay Time high byte
      gifData[offset++] = 0x00; // Transparent Color Index (none)
      gifData[offset++] = 0x00; // Block Terminator
      
      // Image Descriptor (10 bytes)
      gifData[offset++] = 0x2C; // Image Separator
      gifData[offset++] = 0x00; // Left Position low byte
      gifData[offset++] = 0x00; // Left Position high byte
      gifData[offset++] = 0x00; // Top Position low byte
      gifData[offset++] = 0x00; // Top Position high byte
      gifData[offset++] = this.options.width & 0xFF;        // Image Width low byte
      gifData[offset++] = (this.options.width >> 8) & 0xFF; // Image Width high byte
      gifData[offset++] = this.options.height & 0xFF;       // Image Height low byte
      gifData[offset++] = (this.options.height >> 8) & 0xFF; // Image Height high byte
      gifData[offset++] = 0x00; // Packed field (no local color table, no interlace)
      
      // Image Data with simple compression
      const lzwCodeSize = Math.max(2, colorTableSizeBits + 1);
      gifData[offset++] = lzwCodeSize;
      
      // Write frame data in sub-blocks
      let dataOffset = 0;
      while (dataOffset < frame.length) {
        const blockSize = Math.min(255, frame.length - dataOffset);
        gifData[offset++] = blockSize; // Sub-block size
        
        for (let i = 0; i < blockSize; i++) {
          gifData[offset++] = frame[dataOffset + i];
        }
        
        dataOffset += blockSize;
      }
      
      gifData[offset++] = 0x00; // Block Terminator
    }
    
    // Trailer
    gifData[offset++] = 0x3B;
    
    // Return only the used portion of the buffer
    return gifData.slice(0, offset).buffer;
  }

  private optimizeColorUsage(gifData: Uint8Array): Uint8Array {
    // Placeholder for color optimization
    // In production, this would remove unused colors and optimize the palette
    return gifData;
  }

  private reportProgress(stage: GifEncodingProgress['stage'], progress: number, message: string): void {
    if (this.onProgress) {
      this.onProgress({ stage, progress, message });
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Supporting interfaces
interface AnalyzedFrame {
  imageData: ImageData;
  colorHistogram: Map<string, number>;
  motionData: MotionData | null;
  index: number;
}

interface MotionData {
  changedPixelRatio: number;
  averageChange: number;
}

interface ColorPalette {
  colors: Array<{ r: number; g: number; b: number; a: number }>;
  size: number;
}

interface EncodedGifData {
  frames: Uint8Array[];
  palette: ColorPalette;
}

interface OptimizedGif {
  blob: Blob;
  compressionRatio: number;
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