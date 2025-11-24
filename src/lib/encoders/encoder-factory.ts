/**
 * Encoder factory for selecting and creating appropriate encoders
 * Handles feature detection and fallback strategies
 */

import { AbstractEncoder } from './abstract-encoder';
import { GifencEncoder } from './gifenc-encoder';
// GifJsEncoder is lazy-imported to avoid service worker crashes
// It requires DOM which service workers don't have
import { GifskiEncoder } from './gifski-encoder';

export type EncoderType = 'gifenc' | 'gif.js' | 'gifski' | 'auto';
export type FormatType = 'gif' | 'mp4';

interface EncoderPreference {
  primary: EncoderType;
  fallback?: EncoderType;
  format: FormatType;
}

interface EncoderSelection {
  encoder: AbstractEncoder;
  reason: string;
  characteristics: {
    speed: 'fast' | 'medium' | 'slow';
    quality: 'low' | 'medium' | 'high';
    memoryUsage: 'low' | 'medium' | 'high';
    browserSupport: 'excellent' | 'good' | 'limited';
  };
}

export class EncoderFactory {
  private static instance: EncoderFactory;
  private availabilityCache = new Map<string, boolean>();
  private encoderInstances = new Map<string, AbstractEncoder>();

  static getInstance(): EncoderFactory {
    if (!EncoderFactory.instance) {
      EncoderFactory.instance = new EncoderFactory();
    }
    return EncoderFactory.instance;
  }

  /**
   * Get the best available encoder for the specified format and preferences
   */
  async getEncoder(preference: EncoderPreference): Promise<EncoderSelection> {
    const format = preference.format;
    
    // Handle different format types
    if (format === 'mp4') {
      throw new Error(`Format ${format} not yet supported`);
    }

    let selectedEncoder: AbstractEncoder | null = null;
    let selectionReason = '';

    // Try primary encoder first
    if (preference.primary === 'auto') {
      selectedEncoder = await this.selectBestGifEncoder();
      selectionReason = 'Auto-selected based on performance characteristics';
    } else {
      selectedEncoder = await this.getSpecificEncoder(preference.primary);
      if (selectedEncoder) {
        selectionReason = `User preference: ${preference.primary}`;
      }
    }

    // Fallback to secondary encoder if primary failed
    if (!selectedEncoder && preference.fallback) {
      selectedEncoder = await this.getSpecificEncoder(preference.fallback);
      if (selectedEncoder) {
        selectionReason = `Fallback to ${preference.fallback} (primary unavailable)`;
      }
    }

    // Ultimate fallback to any available encoder
    if (!selectedEncoder) {
      selectedEncoder = await this.getAnyAvailableGifEncoder();
      selectionReason = 'Emergency fallback to any available encoder';
    }

    if (!selectedEncoder) {
      throw new Error('No GIF encoder available in this environment');
    }

    return {
      encoder: selectedEncoder,
      reason: selectionReason,
      characteristics: selectedEncoder.characteristics
    };
  }

  /**
   * Get a specific encoder by name
   */
  async getSpecificEncoder(type: EncoderType): Promise<AbstractEncoder | null> {
    if (type === 'auto') {
      return this.selectBestGifEncoder();
    }

    const cacheKey = type;

    // Return cached instance if available
    if (this.encoderInstances.has(cacheKey)) {
      return this.encoderInstances.get(cacheKey)!;
    }

    let encoder: AbstractEncoder;

    switch (type) {
      case 'gifenc':
        encoder = new GifencEncoder();
        break;
      case 'gif.js':
        // Lazy-import GifJsEncoder to avoid loading in service worker
        // Service workers don't have DOM (document, window) which GifJsEncoder requires
        // Check runtime context BEFORE attempting import to prevent webpack chunk loading
        if (typeof document === 'undefined' || typeof window === 'undefined') {
          console.warn('GifJsEncoder requires DOM - not available in service worker context');
          return null;
        }
        try {
          const { GifJsEncoder } = await import(
            /* webpackChunkName: "gifjs-encoder" */
            /* webpackMode: "lazy" */
            './gifjs-encoder'
          );
          encoder = new GifJsEncoder();
        } catch (error) {
          console.warn('GifJsEncoder not available in this environment:', error);
          return null;
        }
        break;
      case 'gifski':
        encoder = new GifskiEncoder();
        break;
      default:
        throw new Error(`Unknown encoder type: ${type}`);
    }

    // Check availability
    const isAvailable = await this.checkEncoderAvailability(encoder);
    if (!isAvailable) {
      return null;
    }

    // Initialize the encoder
    try {
      await encoder.initialize();
      this.encoderInstances.set(cacheKey, encoder);
      return encoder;
    } catch (error) {
      console.warn(`Failed to initialize ${type} encoder:`, error);
      return null;
    }
  }


  /**
   * Automatically select the best GIF encoder based on environment and performance
   */
  private async selectBestGifEncoder(): Promise<AbstractEncoder | null> {
    // Priority order: gifski (highest quality) -> gif.js (quality with dithering) -> gifenc (fast fallback)
    const encoderPriority: EncoderType[] = ['gifski', 'gif.js', 'gifenc'];

    for (const encoderType of encoderPriority) {
      const encoder = await this.getSpecificEncoder(encoderType);
      if (encoder) {
        
        return encoder;
      }
    }

    return null;
  }

  /**
   * Get any available GIF encoder as ultimate fallback
   */
  private async getAnyAvailableGifEncoder(): Promise<AbstractEncoder | null> {
    const allEncoders: EncoderType[] = ['gifski', 'gifenc', 'gif.js'];

    for (const encoderType of allEncoders) {
      try {
        const encoder = await this.getSpecificEncoder(encoderType);
        if (encoder) {
          console.warn(`Using fallback encoder: ${encoderType}`);
          return encoder;
        }
      } catch (error) {
        console.warn(`Fallback encoder ${encoderType} failed:`, error);
      }
    }

    return null;
  }

  /**
   * Check if an encoder is available in the current environment
   */
  private async checkEncoderAvailability(encoder: AbstractEncoder): Promise<boolean> {
    const cacheKey = encoder.name;
    
    if (this.availabilityCache.has(cacheKey)) {
      return this.availabilityCache.get(cacheKey)!;
    }

    try {
      const isAvailable = encoder.isAvailable();
      this.availabilityCache.set(cacheKey, isAvailable);
      return isAvailable;
    } catch (error) {
      console.warn(`Error checking ${encoder.name} availability:`, error);
      this.availabilityCache.set(cacheKey, false);
      return false;
    }
  }

  /**
   * Get information about all available encoders
   */
  async getAvailableEncoders(): Promise<Array<{
    name: string;
    type: EncoderType;
    available: boolean;
    characteristics: AbstractEncoder['characteristics'];
    supportedFormats: string[];
  }>> {
    const encoderTypes: EncoderType[] = ['gifski', 'gifenc', 'gif.js'];
    const results = [];

    for (const type of encoderTypes) {
      try {
        const encoder = await this.createEncoderInstance(type);
        const available = await this.checkEncoderAvailability(encoder);
        
        results.push({
          name: encoder.name,
          type,
          available,
          characteristics: encoder.characteristics,
          supportedFormats: encoder.supportedFormats
        });
      } catch (error) {
        results.push({
          name: type,
          type,
          available: false,
          characteristics: {
            speed: 'slow' as const,
            quality: 'low' as const,
            memoryUsage: 'high' as const,
            browserSupport: 'limited' as const
          },
          supportedFormats: []
        });
      }
    }

    return results;
  }

  /**
   * Benchmark available encoders with sample data
   */
  async benchmarkEncoders(sampleFrameCount = 10): Promise<Array<{
    name: string;
    type: EncoderType;
    available: boolean;
    benchmarkTime?: number;
    framesPerSecond?: number;
    memoryUsage?: number;
  }>> {
    const encoders = await this.getAvailableEncoders();
    const results = [];

    for (const encoderInfo of encoders) {
      if (!encoderInfo.available) {
        results.push({
          name: encoderInfo.name,
          type: encoderInfo.type,
          available: false
        });
        continue;
      }

      try {
        // Create sample frame data
        const sampleFrames = this.createSampleFrames(sampleFrameCount, 320, 240);
        const options = {
          width: 320,
          height: 240,
          frameRate: 10,
          quality: 'medium' as const,
          loop: false
        };

        const encoder = await this.getSpecificEncoder(encoderInfo.type);
        if (!encoder) {
          results.push({
            name: encoderInfo.name,
            type: encoderInfo.type,
            available: false
          });
          continue;
        }

        const startTime = performance.now();
        const memoryBefore = this.getCurrentMemoryUsage();
        
        await encoder.encode(sampleFrames, options);
        
        const benchmarkTime = performance.now() - startTime;
        const memoryAfter = this.getCurrentMemoryUsage();
        const framesPerSecond = (sampleFrameCount / benchmarkTime) * 1000;

        results.push({
          name: encoderInfo.name,
          type: encoderInfo.type,
          available: true,
          benchmarkTime,
          framesPerSecond,
          memoryUsage: memoryAfter && memoryBefore ? memoryAfter - memoryBefore : undefined
        });

      } catch (error) {
        console.warn(`Benchmark failed for ${encoderInfo.name}:`, error);
        results.push({
          name: encoderInfo.name,
          type: encoderInfo.type,
          available: false
        });
      }
    }

    return results;
  }

  /**
   * Clear encoder cache and force re-detection
   */
  clearCache(): void {
    this.availabilityCache.clear();
    this.encoderInstances.clear();
  }

  private async createEncoderInstance(type: EncoderType): Promise<AbstractEncoder> {
    switch (type) {
      case 'gifenc':
        return new GifencEncoder();
      case 'gif.js': {
        // Check runtime context before importing
        if (typeof document === 'undefined' || typeof window === 'undefined') {
          throw new Error('GifJsEncoder requires DOM - not available in service worker context');
        }
        // Lazy-import to avoid service worker crashes
        const { GifJsEncoder } = await import(
          /* webpackChunkName: "gifjs-encoder" */
          /* webpackMode: "lazy" */
          './gifjs-encoder'
        );
        return new GifJsEncoder();
      }
      case 'gifski':
        return new GifskiEncoder();
      default:
        throw new Error(`Unknown encoder type: ${type}`);
    }
  }

  private createSampleFrames(count: number, width: number, height: number) {
    const frames = [];
    
    for (let i = 0; i < count; i++) {
      const data = new Uint8ClampedArray(width * height * 4);
      
      // Create simple gradient pattern
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          data[idx] = (x + i * 10) % 256;     // R
          data[idx + 1] = (y + i * 10) % 256; // G
          data[idx + 2] = (i * 25) % 256;     // B
          data[idx + 3] = 255;                // A
        }
      }
      
      frames.push({
        imageData: new ImageData(data, width, height),
        timestamp: i * 100,
        delay: 100
      });
    }
    
    return frames;
  }

  private getCurrentMemoryUsage(): number | undefined {
    if ('memory' in performance) {
      const memInfo = (performance as Performance & { memory?: { usedJSHeapSize?: number } }).memory;
      return memInfo?.usedJSHeapSize;
    }
    return undefined;
  }
}

// Convenience functions
export const encoderFactory = EncoderFactory.getInstance();

