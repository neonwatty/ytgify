/**
 * Main encoder module - unified interface for all encoding operations
 * Provides backward compatibility while enabling new encoder features
 */

export { AbstractEncoder } from './abstract-encoder';
export { GifencEncoder } from './gifenc-encoder';
export { GifJsEncoder } from './gifjs-encoder';
export { 
  EncoderFactory, 
  encoderFactory, 
  selectEncoder, 
  getPerformanceRecommendations 
} from './encoder-factory';

export type { 
  EncodingProgress, 
  EncodingResult, 
  EncodingOptions, 
  FrameData 
} from './abstract-encoder';

export type { 
  EncoderType, 
  FormatType, 
  EncoderPreference, 
  EncoderSelection 
} from './encoder-factory';

// Convenience functions for common operations
import { 
  encoderFactory, 
  EncoderType, 
  FormatType 
} from './encoder-factory';
import { 
  EncodingOptions, 
  FrameData, 
  EncodingResult, 
  EncodingProgress 
} from './abstract-encoder';

/**
 * Encode frames using the best available encoder
 */
export async function encodeFrames(
  frames: FrameData[],
  options: EncodingOptions,
  preferences?: {
    encoder?: EncoderType;
    format?: FormatType;
    onProgress?: (progress: EncodingProgress) => void;
    abortSignal?: AbortSignal;
  }
): Promise<EncodingResult> {
  const selection = await encoderFactory.getEncoder({
    primary: preferences?.encoder || 'auto',
    fallback: 'gif.js',
    format: preferences?.format || 'gif'
  });

  return selection.encoder.encode(
    frames,
    options,
    preferences?.onProgress,
    preferences?.abortSignal
  );
}

/**
 * Get encoder recommendations for current environment
 */
export async function getEncoderRecommendations(): Promise<{
  available: Array<{
    name: string;
    type: EncoderType;
    available: boolean;
    characteristics: Record<string, unknown>;
  }>;
  recommended: {
    encoder: EncoderType;
    reason: string;
  };
}> {
  const [available, recommendations] = await Promise.all([
    encoderFactory.getAvailableEncoders(),
    import('./encoder-factory').then(m => m.getPerformanceRecommendations())
  ]);

  return {
    available,
    recommended: {
      encoder: recommendations.recommended,
      reason: recommendations.reason
    }
  };
}