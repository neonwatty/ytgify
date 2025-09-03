/**
 * Jest test setup file
 * 
 * This file is run before each test file is executed.
 * It sets up the testing environment with Chrome extension API mocks,
 * DOM polyfills, and other necessary testing utilities.
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-namespace */

import '@testing-library/jest-dom';
import { chromeMock } from './chrome-mocks';

// Set up Chrome extension API mocks globally
(global as any).chrome = chromeMock;

// Mock localStorage for fallback storage testing
interface LocalStorageMock {
  getItem: jest.MockedFunction<(key: string) => string | null>;
  setItem: jest.MockedFunction<(key: string, value: string) => void>;
  removeItem: jest.MockedFunction<(key: string) => void>;
  clear: jest.MockedFunction<() => void>;
  store: Record<string, string>;
}

const localStorageMock: LocalStorageMock = {
  getItem: jest.fn((key: string): string | null => {
    return localStorageMock.store[key] || null;
  }),
  setItem: jest.fn((key: string, value: string): void => {
    localStorageMock.store[key] = value.toString();
  }),
  removeItem: jest.fn((key: string): void => {
    delete localStorageMock.store[key];
  }),
  clear: jest.fn((): void => {
    localStorageMock.store = {};
  }),
  store: {} as Record<string, string>,
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock sessionStorage
Object.defineProperty(window, 'sessionStorage', {
  value: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
});

// Mock window.close for popup testing
Object.defineProperty(window, 'close', {
  value: jest.fn(),
});

// Mock URL and Blob for file handling tests
global.URL = {
  createObjectURL: jest.fn(() => 'mock-blob-url'),
  revokeObjectURL: jest.fn(),
} as any;

global.Blob = class MockBlob {
  constructor(public parts: BlobPart[], public options: BlobPropertyBag = {}) {}
  
  size = 1024;
  type = this.options.type || 'application/octet-stream';
  
  slice = jest.fn();
  stream = jest.fn();
  text = jest.fn().mockResolvedValue('mock text');
  arrayBuffer = jest.fn().mockResolvedValue(new ArrayBuffer(8));
} as unknown as typeof Blob;

// Mock File constructor
global.File = class MockFile extends global.Blob {
  constructor(parts: BlobPart[], public name: string, options: FilePropertyBag = {}) {
    super(parts, options);
  }
  
  lastModified = Date.now();
  webkitRelativePath = '';
} as unknown as typeof File;

// Mock Canvas and CanvasRenderingContext2D for GIF processing tests
interface MockCanvas {
  getContext: jest.MockedFunction<any>;
  width: number;
  height: number;
  toBlob: jest.MockedFunction<(callback: BlobCallback) => void>;
  toDataURL: jest.MockedFunction<() => string>;
}

const mockCanvas: MockCanvas = {
  getContext: jest.fn((): any => ({
    drawImage: jest.fn(),
    getImageData: jest.fn(() => ({
      data: new Uint8ClampedArray(4),
      width: 1,
      height: 1,
    })),
    putImageData: jest.fn(),
    createImageData: jest.fn(),
    canvas: mockCanvas,
  })),
  width: 100,
  height: 100,
  toBlob: jest.fn((callback: BlobCallback): void => {
    callback(new global.Blob(['mock canvas data'], { type: 'image/png' }));
  }),
  toDataURL: jest.fn((): string => 'data:image/png;base64,mock-data'),
};

global.HTMLCanvasElement = jest.fn(() => mockCanvas) as unknown as typeof HTMLCanvasElement;

// Mock Image constructor for video frame processing
global.Image = class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = '';
  width = 100;
  height = 100;
  
  constructor() {
    setTimeout(() => {
      if (this.onload) {
        this.onload();
      }
    }, 10);
  }
} as unknown as typeof Image;

// Mock HTMLVideoElement for YouTube video interaction
Object.defineProperty(HTMLVideoElement.prototype, 'currentTime', {
  get: jest.fn(() => 0),
  set: jest.fn(),
});

Object.defineProperty(HTMLVideoElement.prototype, 'duration', {
  get: jest.fn(() => 100),
  set: jest.fn(),
});

Object.defineProperty(HTMLVideoElement.prototype, 'paused', {
  get: jest.fn(() => false),
  set: jest.fn(),
});

HTMLVideoElement.prototype.play = jest.fn().mockResolvedValue(undefined);
HTMLVideoElement.prototype.pause = jest.fn();

// Mock MutationObserver for DOM change detection
global.MutationObserver = class MockMutationObserver {
  constructor(private callback: MutationCallback) {}
  
  observe = jest.fn();
  disconnect = jest.fn();
  takeRecords = jest.fn(() => []);
} as unknown as typeof MutationObserver;

// Mock IntersectionObserver for UI component testing
global.IntersectionObserver = class MockIntersectionObserver {
  constructor(private callback: IntersectionObserverCallback) {}
  
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
} as unknown as typeof IntersectionObserver;

// Mock ResizeObserver for responsive component testing
global.ResizeObserver = class MockResizeObserver {
  constructor(private callback: ResizeObserverCallback) {}
  
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
} as unknown as typeof ResizeObserver;

// Mock requestAnimationFrame and cancelAnimationFrame
global.requestAnimationFrame = jest.fn((callback) => {
  return setTimeout(callback, 16); // ~60fps
});

global.cancelAnimationFrame = jest.fn((id) => {
  clearTimeout(id);
});

// Mock fetch for API calls
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    blob: () => Promise.resolve(new global.Blob()),
  } as Response)
);

// Console spy setup for testing console outputs
const originalConsole = { ...console };

beforeEach(() => {
  // Reset localStorage mock
  localStorageMock.clear();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  
  // Reset console spies
  jest.clearAllMocks();
});

afterEach(() => {
  // Restore console if it was spied on
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
});

// Export testing utilities for use in test files
export { localStorageMock };
export { chromeMock };

// Type declarations for global mocks
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toHaveClass(className: string): R;
      toHaveTextContent(text: string): R;
    }
  }
}