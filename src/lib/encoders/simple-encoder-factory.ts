// Simple encoder factory for our base encoder system
import { BaseEncoder, EncoderOptions } from './base-encoder';
// import { GifencEncoderSimple } from './gifenc-encoder-simple';
import { logger } from '@/lib/logger';

type EncoderType = 'gifenc' | 'auto';

export class SimpleEncoderFactory {
  /**
   * Create an encoder instance
   */
  static createEncoder(type: EncoderType = 'auto', options: EncoderOptions): BaseEncoder {
    logger.info('[SimpleEncoderFactory] Creating encoder', { type, options });

    // This encoder is currently disabled due to compatibility issues
    logger.error('[SimpleEncoderFactory] Simple encoder is disabled');
    throw new Error('Simple encoder is currently disabled - use main encoder factory instead');
  }

  /**
   * Check if gifenc is available
   */
  static isGifencAvailable(): boolean {
    try {
      import('gifenc');
      return true;
    } catch {
      return false;
    }
  }
}
