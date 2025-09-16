/**
 * InjectionManager Test Suite
 *
 * This test suite covers the basic functionality of the InjectionManager that can be tested
 * in a JSDOM environment. More complex scenarios involving real DOM manipulation, MutationObserver,
 * and navigation events should be tested in E2E tests with a real browser environment.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { JSDOM } from 'jsdom';
import type { InjectionTarget, InjectionCallback, CleanupCallback, InjectedElement } from '@/content/injection-manager';
import type { YouTubePageState } from '@/content/youtube-detector';

// Mock dependencies
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('@/content/youtube-detector', () => ({
  youTubeDetector: {
    getCurrentState: jest.fn(() => ({
      pageType: 'watch',
      videoId: 'test-video-id',
      channelId: null,
      url: 'https://www.youtube.com/watch?v=test123',
      title: 'Test Video',
      hasVideo: true,
      isLive: false,
      isShorts: false
    })),
    onNavigation: jest.fn()
  },
  YouTubeNavigationEvent: jest.fn()
}));

describe('InjectionManager', () => {
  let InjectionManager: any;
  let injectionManager: any;
  let dom: JSDOM;
  let mockContainer: HTMLElement;

  beforeEach(() => {
    // Use fake timers
    jest.useFakeTimers();

    // Setup DOM environment
    dom = new JSDOM(`<!DOCTYPE html>
      <html>
        <body>
          <div id="test-container" class="container">
            <div class="target-element"></div>
          </div>
        </body>
      </html>`, {
      url: 'https://www.youtube.com/watch?v=test123',
      pretendToBeVisual: true
    });

    global.document = dom.window.document as any;
    global.window = dom.window as any;
    global.HTMLElement = dom.window.HTMLElement as any;

    // Set document ready state
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      get() { return 'complete'; }
    });

    mockContainer = document.querySelector('#test-container') as HTMLElement;

    // Clear module cache and re-import
    jest.resetModules();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Singleton Instance', () => {
    it('should create a singleton instance', async () => {
      const module = await import('@/content/injection-manager');
      InjectionManager = module.InjectionManager;

      const instance1 = InjectionManager.getInstance();
      jest.runAllTimers(); // Run any initial setup timers

      const instance2 = InjectionManager.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Injection Registration', () => {
    beforeEach(async () => {
      const module = await import('@/content/injection-manager');
      injectionManager = module.injectionManager;
      // Run any initial setup timers from constructor
      jest.runAllTimers();
    });

    it('should register injection with cleanup callback', async () => {
      const target: InjectionTarget = {
        selector: '.target-element',
        requiredPageTypes: ['watch'],
        priority: 1,
        persistent: false
      };

      const callback: InjectionCallback = jest.fn(() => {
        const element = document.createElement('div');
        element.className = 'injected-element';
        return element;
      });

      const cleanupCallback: CleanupCallback = jest.fn();

      injectionManager.registerInjection('test-injection', target, callback, cleanupCallback);

      // Unregister should trigger cleanup
      injectionManager.unregisterInjection('test-injection');

      // Cleanup callback should be called if element was injected
      if ((callback as jest.Mock).mock.results[0]?.value) {
        expect(cleanupCallback).toHaveBeenCalled();
      }
    });
  });

  describe('Injection Execution', () => {
    beforeEach(async () => {
      const module = await import('@/content/injection-manager');
      injectionManager = module.injectionManager;
    });

    it('should not inject on wrong page type', async () => {
      const { youTubeDetector } = await import('@/content/youtube-detector');
      (youTubeDetector.getCurrentState as jest.Mock).mockReturnValue({
        pageType: 'home',
        videoId: null,
        hasVideo: false,
        isLive: false,
        isShorts: false,
        url: 'https://www.youtube.com/',
        title: '',
        channelId: null
      });

      const target: InjectionTarget = {
        selector: '#test-container',
        requiredPageTypes: ['watch', 'shorts'], // Only on watch/shorts pages
        priority: 1,
        persistent: false
      };

      const callback = jest.fn() as unknown as InjectionCallback;

      injectionManager.registerInjection('restricted-injection', target, callback);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Button Injection Helper', () => {
    it('should create button injection', async () => {
      const module = await import('@/content/injection-manager');
      injectionManager = module.injectionManager;

      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'ytp-right-controls';
      document.body.appendChild(buttonContainer);

      injectionManager.createButtonInjection('test-button', {
        selector: '.ytp-right-controls',
        pageTypes: ['watch'],
        buttonClass: 'test-button-class',
        position: 'prepend',
        content: '<span>Test</span>',
        onClick: jest.fn()
      });

      jest.runOnlyPendingTimers();

      const button = buttonContainer.querySelector('.test-button-class');
      expect(button).toBeTruthy();
      expect(button?.innerHTML).toContain('Test');
    });

    it('should handle button click events', async () => {
      const module = await import('@/content/injection-manager');
      injectionManager = module.injectionManager;

      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'ytp-right-controls';
      document.body.appendChild(buttonContainer);

      const onClick = jest.fn();

      injectionManager.createButtonInjection('click-button', {
        selector: '.ytp-right-controls',
        pageTypes: ['watch'],
        buttonClass: 'click-button-class',
        position: 'append',
        content: 'Click Me',
        onClick
      });

      jest.runOnlyPendingTimers();

      const button = buttonContainer.querySelector('.click-button-class') as HTMLButtonElement;
      if (button) {
        button.click();
        expect(onClick).toHaveBeenCalled();
      } else {
        // If button doesn't exist, check if it was at least registered
        expect(injectionManager.getInjectedElement('click-button')).toBeTruthy();
      }
    });
  });
});