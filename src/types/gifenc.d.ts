// Type declarations for gifenc library
declare module 'gifenc' {
  export function quantize(
    pixels: number[][],
    colors: number,
    options?: { method?: 'neuquant' | 'octree' }
  ): number[][];
  
  export function applyPalette(
    pixels: Uint8Array,
    palette: number[][],
    format?: 'rgba565' | 'rgba'
  ): Uint8Array;
  
  export function nearestColorIndex(
    pixel: number[],
    palette: number[][]
  ): number;
}