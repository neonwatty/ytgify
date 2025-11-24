// External Links Constants

// Helper to open external link in new tab
export function openExternalLink(url: string): void {
  // Check if we're in a context that can use chrome.tabs (popup/background)
  // or content script context (use window.open)
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    chrome.tabs.create({ url }).catch(() => {
      // Fallback to window.open if chrome.tabs.create fails (content script context)
      window.open(url, '_blank', 'noopener,noreferrer');
    });
  } else if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

// Helper to get review link
export function getReviewLink(): string {
  return 'https://chromewebstore.google.com/detail/ytgify/dnljofakogbecppbkmnoffppkfdmpfje/reviews';
}

// Helper to get Discord invite link
export function getDiscordLink(): string {
  return 'https://discord.gg/8EUxqR93';
}
