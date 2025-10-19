// External Links Constants

export const LINKS = {
  // Chrome Web Store
  WEBSTORE_LISTING: 'https://chromewebstore.google.com/detail/ytgify/dnljofakogbecppbkmnoffppkfdmpfje',
  WEBSTORE_REVIEWS: 'https://chromewebstore.google.com/detail/ytgify/dnljofakogbecppbkmnoffppkfdmpfje/reviews',

  // GitHub
  GITHUB_REPO: 'https://github.com/neonwatty/ytgify',
  GITHUB_STARS: 'https://github.com/neonwatty/ytgify/stargazers',
  GITHUB_ISSUES: 'https://github.com/neonwatty/ytgify/issues',

  // Social
  TWITTER_PROFILE: 'https://x.com/neonwatty',

  // Documentation
  DOCS_USER_GUIDE: 'https://github.com/neonwatty/ytgify#user-guide'
} as const;

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
  return LINKS.WEBSTORE_REVIEWS;
}

// Helper to get GitHub star link
export function getGitHubStarLink(): string {
  return LINKS.GITHUB_REPO;
}
