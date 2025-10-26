import './style.css'; // Direct CSS import for shadow DOM
import { defineContentScript } from 'wxt/sandbox';
import { WXTYouTubeNavigator } from './navigation';
import { ShadowDOMUIManager } from './ui-manager';
import { YouTubeGifMaker } from './gif-maker'; // Now unblocked: Singletons refactored to factory functions

// Note: matches must be static array for Chrome extension manifest
// Localhost permissions added for mock E2E tests - production build strips these via wxt.config.ts
export default defineContentScript({
  matches: [
    '*://*.youtube.com/*',
    'http://localhost:*/*',
    'http://127.0.0.1:*/*'
  ],
  runAt: 'document_end',
  cssInjectionMode: 'manifest', // Use manifest mode for reliable loading in tests

  main(ctx) {
    console.log('WXT Content Script - Initialized', {
      url: window.location.href
    });

    // Initialize WXT-based navigation detection
    const navigator = new WXTYouTubeNavigator(ctx);

    // Initialize Shadow DOM UI manager
    const uiManager = new ShadowDOMUIManager(ctx);

    // Initialize YouTubeGifMaker with WXT dependencies
    const gifMaker = new YouTubeGifMaker(ctx, navigator, uiManager);

    // Setup WXT-specific cleanup
    ctx.onInvalidated(() => {
      console.log('Extension context invalidated - cleaning up');
      gifMaker.destroy();
      navigator.destroy();
      uiManager.destroyAll();
    });
  },
});
