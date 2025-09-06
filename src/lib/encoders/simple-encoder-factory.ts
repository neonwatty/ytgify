// Simple encoder factory for our base encoder system
import { BaseEncoder, EncoderOptions } from './base-encoder';
import { GifencEncoderSimple } from './gifenc-encoder-simple';
import { logger } from '@/lib/logger';

export type EncoderType = 'gifenc' | 'auto';

export class SimpleEncoderFactory {
  /**
   * Create an encoder instance
   */
  static createEncoder(
    type: EncoderType = 'auto',
    options: EncoderOptions
  ): BaseEncoder {
    logger.info('[SimpleEncoderFactory] Creating encoder', { type, options });
    
    // Always use gifenc as it's the best option for GIF creation
    try {
      const encoder = new GifencEncoderSimple(options);
      logger.info('[SimpleEncoderFactory] Created gifenc encoder successfully');
      return encoder;
    } catch (error) {
      logger.error('[SimpleEncoderFactory] Failed to create encoder', { error });
      throw new Error('Failed to create GIF encoder: gifenc is required');
    }
  }
  
  /**
   * Check if gifenc is available
   */
  static isGifencAvailable(): boolean {
    try {
      require('gifenc');
      return true;
    } catch {
      return false;
    }
  }
}