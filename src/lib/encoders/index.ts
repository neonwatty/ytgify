/**
 * Main encoder module - unified interface for all encoding operations
 * Provides backward compatibility while enabling new encoder features
 */

/** @public */
export type {
  EncodingProgress,
  EncodingResult,
  EncodingOptions,
  FrameData
} from './abstract-encoder';

/** @public */
export type {
  EncoderType
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

