// Type declarations for gifenc library
declare module 'gifenc' {
  export class GIFEncoder {
    constructor(options?: { auto?: boolean });
    writeHeader(): void;
    writeFrame(
      indices: Uint8Array,
      width: number,
      height: number,
      opts?: {
        palette?: number[][];
        delay?: number;
        dispose?: number;
        transparent?: boolean | number;
        first?: boolean;
        repeat?: number;
      }
    ): void;
    finish(): void;
    bytes(): Uint8Array;
    stream: {
      writeByte(byte: number): void;
      writeBytes(data: Uint8Array, offset?: number, byteLength?: number): void;
    };
  }

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: {
      format?: 'rgb565' | 'rgb444' | 'rgba4444';
      oneBitAlpha?: boolean | number;
      clearAlpha?: boolean;
      clearAlphaThreshold?: number;
      clearAlphaColor?: number;
    }
  ): number[][];

  export function applyPalette(
    pixels: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: 'rgb565' | 'rgb444' | 'rgba4444'
  ): Uint8Array;

  export function nearestColorIndex(
    pixel: number[],
    palette: number[][]
  ): number;
}