import './style.css'; // Direct CSS import for shadow DOM
import { WXTYouTubeNavigator } from './navigation';
import { ShadowDOMUIManager } from './ui-manager';
import { YouTubeGifMaker } from './gif-maker'; // Now unblocked: Singletons refactored to factory functions

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
