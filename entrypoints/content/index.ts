import './style.css'; // Direct CSS import for shadow DOM
import { WXTYouTubeNavigator } from './navigation';
import { ShadowDOMUIManager } from './ui-manager';
// import { YouTubeGifMaker } from './gif-maker'; // BLOCKED: See MIGRATION_NOTES.md

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
    // BLOCKED BY: WXT doesn't support @/* wildcard path aliases (GitHub issue #1663)
    // Resolution requires either:
    // 1. WXT fixing wildcard alias support
    // 2. Moving src/* files to root to match @/* → ./* default
    // 3. Converting all @/* imports to relative paths in src/**
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
