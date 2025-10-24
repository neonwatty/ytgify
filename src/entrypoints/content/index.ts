import './style.css'; // Direct CSS import for shadow DOM
import { WXTYouTubeNavigator } from './navigation';
import { ShadowDOMUIManager } from './ui-manager';
// import { YouTubeGifMaker } from './gif-maker'; // BLOCKED: Old singletons cause window access during build

export default defineContentScript({
  matches: ['*://*.youtube.com/*'],
  runAt: 'document_end',
  cssInjectionMode: 'ui', // Critical for shadow DOM CSS isolation

  main(ctx) {
    console.log('WXT Content Script - Initialized', {
      id: browser.runtime.id,
      url: window.location.href
    });

    // Initialize WXT-based navigation detection
    const navigator = new WXTYouTubeNavigator(ctx);

    // Initialize Shadow DOM UI manager
    const uiManager = new ShadowDOMUIManager(ctx);

    // TODO: Initialize YouTubeGifMaker with WXT dependencies
    // BLOCKED: Old singleton pattern in src/content/* files causes window access during WXT build
    // Files affected: injection-manager.ts, player-integration.ts, youtube-detector.ts
    // Solution: Refactor singletons to lazy initialization or convert to factory functions
    // const gifMaker = new YouTubeGifMaker(ctx, navigator, uiManager);

    // Setup WXT-specific cleanup
    ctx.onInvalidated(() => {
      console.log('Extension context invalidated - cleaning up');
      // gifMaker.destroy();
      navigator.destroy();
      uiManager.destroyAll();
    });
  },
});
