declare module 'gif.js' {
  export interface GIFOptions {
    width?: number;
    height?: number;
    quality?: number;
    workers?: number;
    workerScript?: string;
    repeat?: number;
    transparent?: number | string;
    background?: string;
    dither?: boolean | string;
    debug?: boolean;
  }

  export interface AddFrameOptions {
    delay?: number;
    copy?: boolean;
    dispose?: number;
  }

  export default class GIF {
    constructor(options?: GIFOptions);
    
    addFrame(
      imageElement: HTMLImageElement | HTMLCanvasElement | CanvasRenderingContext2D | ImageData,
      options?: AddFrameOptions
    ): void;
    
    on(event: 'start' | 'abort', callback: () => void): void;
    on(event: 'progress', callback: (progress: number) => void): void;
    on(event: 'finished', callback: (blob: Blob) => void): void;
    on(event: 'error', callback: (error: Error) => void): void;
    
    render(): void;
    abort(): void;
    running: boolean;
  }
}

declare module 'gif.js/dist/gif.js' {
  export interface GIFOptions {
    width?: number;
    height?: number;
    quality?: number;
    workers?: number;
    workerScript?: string;
    repeat?: number;
    transparent?: number | string;
    background?: string;
    dither?: boolean | string;
    debug?: boolean;
  }

  export interface AddFrameOptions {
    delay?: number;
    copy?: boolean;
    dispose?: number;
  }

  export default class GIF {
    constructor(options?: GIFOptions);
    
    addFrame(
      imageElement: HTMLImageElement | HTMLCanvasElement | CanvasRenderingContext2D | ImageData,
      options?: AddFrameOptions
    ): void;
    
    on(event: 'start' | 'abort', callback: () => void): void;
    on(event: 'progress', callback: (progress: number) => void): void;
    on(event: 'finished', callback: (blob: Blob) => void): void;
    on(event: 'error', callback: (error: Error) => void): void;
    
    render(): void;
    abort(): void;
    running: boolean;
  }
}