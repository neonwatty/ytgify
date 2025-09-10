/**
 * gifenc encoder implementation - high-performance GIF encoder
 * Often 2x faster than gif.js with similar quality
 */

import { quantize, applyPalette, nearestColorIndex } from 'gifenc';
import { 
  AbstractEncoder, 
  EncodingOptions, 
  EncodingResult, 
  EncodingProgress, 
  FrameData 
} from './abstract-encoder';

export class GifencEncoder extends AbstractEncoder {
  private encoder: any = null;

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
      browserSupport: 'excellent' as const
    };
  }

  isAvailable(): boolean {
    try {
      // Try to import gifenc functions
      return typeof quantize === 'function';
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

    // Convert quality setting to numeric value for gifenc
    const quality = this.mapQualityToNumber(options.quality);
    const frameDelay = Math.round(1000 / options.frameRate); // Convert to milliseconds

    // Create GIF format structure
    const format = this.createGifFormat(options);
    const chunks: Uint8Array[] = [];

    // Write GIF header
    chunks.push(this.createGifHeader(options));
    chunks.push(this.createLogicalScreenDescriptor(options));

    this.reportProgress('preparing', 10, 'Analyzing color palette');

    // Extract all pixel data for global color analysis
    const allPixels: Uint8Array[] = [];
    for (let i = 0; i < frames.length; i++) {
      if (this.abortController?.signal.aborted) {
        throw new Error('Encoding cancelled');
      }

      const frame = frames[i];
      const pixels = new Uint8Array(frame.imageData.data.buffer);
      allPixels.push(pixels);

      if (i % 10 === 0) {
        const progress = 10 + Math.round((i / frames.length) * 20);
        this.reportProgress('preparing', progress, `Analyzing frame ${i + 1}/${frames.length}`);
      }
    }

    // Generate global color palette
    this.reportProgress('preparing', 30, 'Generating color palette');
    const palette = await this.generateGlobalPalette(allPixels, quality);
    
    // Write global color table
    chunks.push(this.createGlobalColorTable(palette));

    this.reportProgress('encoding', 40, 'Encoding frames');

    // Add application extension for loop count
    if (options.loop) {
      chunks.push(this.createApplicationExtension());
    }

    // Encode frames
    for (let i = 0; i < frames.length; i++) {
      if (this.abortController?.signal.aborted) {
        throw new Error('Encoding cancelled');
      }

      const frame = frames[i];
      const customDelay = frame.delay !== undefined ? frame.delay : frameDelay;
      
      // Add frame with delay
      const frameChunks = await this.encodeFrame(frame, palette, customDelay, i);
      chunks.push(...frameChunks);

      const progress = 40 + Math.round((i / frames.length) * 50);
      this.reportProgress('encoding', progress, `Encoding frame ${i + 1}/${frames.length}`);

      // Yield control periodically
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    this.reportProgress('finalizing', 90, 'Finalizing GIF');

    // Write trailer
    chunks.push(new Uint8Array([0x3B])); // GIF trailer

    // Combine all chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const gifBuffer = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      gifBuffer.set(chunk, offset);
      offset += chunk.length;
    }

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
        format: 'gif',
        encoder: this.name
      },
      performance: {
        success: true,
        efficiency: this.calculateEfficiency(encodingTime, frames.length),
        recommendations: this.generateRecommendations(options, frames.length, encodingTime),
        peakMemoryUsage: this.getCurrentMemoryUsage() || 0
      }
    };
  }

  private mapQualityToNumber(quality: 'low' | 'medium' | 'high' | number): number {
    if (typeof quality === 'number') return quality;
    
    switch (quality) {
      case 'low': return 20;
      case 'medium': return 10;
      case 'high': return 5;
      default: return 10;
    }
  }

  private createGifFormat(options: EncodingOptions) {
    return {
      width: options.width,
      height: options.height,
      loops: options.loop ? 0 : 1,
      colorResolution: 8
    };
  }

  private createGifHeader(options: EncodingOptions): Uint8Array {
    const header = new Uint8Array(6);
    // GIF89a signature
    header.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 0);
    return header;
  }

  private createLogicalScreenDescriptor(options: EncodingOptions): Uint8Array {
    const lsd = new Uint8Array(7);
    
    // Canvas width (little endian)
    lsd[0] = options.width & 0xFF;
    lsd[1] = (options.width >> 8) & 0xFF;
    
    // Canvas height (little endian)
    lsd[2] = options.height & 0xFF;
    lsd[3] = (options.height >> 8) & 0xFF;
    
    // Global Color Table Flag: 1, Color Resolution: 7, Sort Flag: 0, Global Color Table Size: 7
    lsd[4] = 0xF7; // 11110111
    
    // Background Color Index
    lsd[5] = 0;
    
    // Pixel Aspect Ratio
    lsd[6] = 0;
    
    return lsd;
  }

  private async generateGlobalPalette(allPixels: Uint8Array[], quality: number): Promise<number[][]> {
    // Combine samples from all frames for global palette
    const sampleSize = Math.min(10000, allPixels.length * 256); // Limit samples for performance
    const samples: number[][] = [];
    
    const step = Math.max(1, Math.floor(allPixels.length * 256 / sampleSize));
    
    for (let frameIdx = 0; frameIdx < allPixels.length; frameIdx++) {
      const pixels = allPixels[frameIdx];
      
      for (let i = 0; i < pixels.length; i += step * 4) {
        if (samples.length >= sampleSize) break;
        
        samples.push([
          pixels[i],     // R
          pixels[i + 1], // G
          pixels[i + 2], // B
        ]);
      }
      
      if (samples.length >= sampleSize) break;
    }

    // Use gifenc quantization
    const palette = quantize(samples, 256, { method: 'neuquant' });
    return palette;
  }

  private createGlobalColorTable(palette: number[][]): Uint8Array {
    const colorTableSize = 256 * 3; // 256 colors, 3 bytes each
    const colorTable = new Uint8Array(colorTableSize);
    
    for (let i = 0; i < palette.length && i < 256; i++) {
      const color = palette[i];
      colorTable[i * 3] = color[0];     // R
      colorTable[i * 3 + 1] = color[1]; // G
      colorTable[i * 3 + 2] = color[2]; // B
    }
    
    // Fill remaining slots with black
    for (let i = palette.length; i < 256; i++) {
      colorTable[i * 3] = 0;     // R
      colorTable[i * 3 + 1] = 0; // G
      colorTable[i * 3 + 2] = 0; // B
    }
    
    return colorTable;
  }

  private createApplicationExtension(): Uint8Array {
    const ext = new Uint8Array(19);
    ext[0] = 0x21;    // Extension Introducer
    ext[1] = 0xFF;    // Application Extension Label
    ext[2] = 0x0B;    // Block Size
    ext.set([0x4E, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2E, 0x30], 3); // "NETSCAPE2.0"
    ext[14] = 0x03;   // Sub-block Size
    ext[15] = 0x01;   // Sub-block ID
    ext[16] = 0x00;   // Loop Count (low byte) - 0 = infinite
    ext[17] = 0x00;   // Loop Count (high byte)
    ext[18] = 0x00;   // Block Terminator
    return ext;
  }

  private async encodeFrame(
    frame: FrameData,
    palette: number[][],
    delay: number,
    frameIndex: number
  ): Promise<Uint8Array[]> {
    const chunks: Uint8Array[] = [];
    
    // Graphics Control Extension
    const gce = new Uint8Array(8);
    gce[0] = 0x21;    // Extension Introducer
    gce[1] = 0xF9;    // Graphic Control Label
    gce[2] = 0x04;    // Block Size
    gce[3] = 0x08;    // Packed Fields: Disposal Method = 2 (restore to background)
    gce[4] = delay & 0xFF;        // Delay Time (low byte)
    gce[5] = (delay >> 8) & 0xFF; // Delay Time (high byte)
    gce[6] = 0x00;    // Transparent Color Index (none)
    gce[7] = 0x00;    // Block Terminator
    chunks.push(gce);
    
    // Image Descriptor
    const imageDesc = new Uint8Array(10);
    imageDesc[0] = 0x2C; // Image Separator
    imageDesc[1] = 0x00; // Left Position (low byte)
    imageDesc[2] = 0x00; // Left Position (high byte)
    imageDesc[3] = 0x00; // Top Position (low byte)
    imageDesc[4] = 0x00; // Top Position (high byte)
    imageDesc[5] = frame.imageData.width & 0xFF;        // Image Width (low byte)
    imageDesc[6] = (frame.imageData.width >> 8) & 0xFF; // Image Width (high byte)
    imageDesc[7] = frame.imageData.height & 0xFF;        // Image Height (low byte)
    imageDesc[8] = (frame.imageData.height >> 8) & 0xFF; // Image Height (high byte)
    imageDesc[9] = 0x00; // Packed Fields: Local Color Table Flag = 0
    chunks.push(imageDesc);
    
    // Convert frame to palette indices
    const pixels = new Uint8Array(frame.imageData.data.buffer);
    const indices = applyPalette(pixels, palette, 'rgba565');
    
    // LZW compress the indices
    const compressed = this.lzwEncode(indices);
    
    // Write compressed data in sub-blocks
    let offset = 0;
    while (offset < compressed.length) {
      const blockSize = Math.min(255, compressed.length - offset);
      const block = new Uint8Array(blockSize + 1);
      block[0] = blockSize;
      block.set(compressed.slice(offset, offset + blockSize), 1);
      chunks.push(block);
      offset += blockSize;
    }
    
    // Block terminator
    chunks.push(new Uint8Array([0x00]));
    
    return chunks;
  }

  private lzwEncode(data: Uint8Array): Uint8Array {
    // Simple LZW implementation for GIF
    // This is a basic implementation - gifenc might have better optimizations
    const minCodeSize = 8;
    const output: number[] = [];
    
    // Initialize dictionary
    let dictSize = (1 << minCodeSize) + 2;
    const dict = new Map<string, number>();
    
    // Initialize dictionary with single-character strings
    for (let i = 0; i < (1 << minCodeSize); i++) {
      dict.set(String.fromCharCode(i), i);
    }
    
    let w = '';
    for (let i = 0; i < data.length; i++) {
      const c = String.fromCharCode(data[i]);
      const wc = w + c;
      
      if (dict.has(wc)) {
        w = wc;
      } else {
        output.push(dict.get(w) || 0);
        dict.set(wc, dictSize++);
        w = c;
      }
    }
    
    if (w) {
      output.push(dict.get(w) || 0);
    }
    
    // Convert to bytes (simplified)
    const result = new Uint8Array(output.length + 1);
    result[0] = minCodeSize;
    for (let i = 0; i < output.length; i++) {
      result[i + 1] = output[i] & 0xFF;
    }
    
    return result;
  }

  private calculateEfficiency(encodingTime: number, frameCount: number): number {
    const timePerFrame = encodingTime / frameCount;
    // Efficiency score based on frames per second processed
    // Above 50 fps = excellent (1.0), below 10 fps = poor (0.3)
    const fps = 1000 / timePerFrame;
    return Math.max(0.3, Math.min(1.0, fps / 50));
  }

  private generateRecommendations(
    options: EncodingOptions,
    frameCount: number,
    encodingTime: number
  ): string[] {
    const recommendations: string[] = [];
    const timePerFrame = encodingTime / frameCount;
    
    if (timePerFrame > 100) {
      recommendations.push('Consider reducing frame count or resolution for faster encoding');
    }
    
    if (frameCount > 200) {
      recommendations.push('Large frame count detected, consider reducing duration');
    }
    
    if (options.width * options.height > 640 * 480) {
      recommendations.push('High resolution detected, consider reducing for smaller file size');
    }
    
    if (options.quality === 'high' && encodingTime > 10000) {
      recommendations.push('High quality setting with long encoding time, consider "medium" quality');
    }
    
    return recommendations;
  }
}