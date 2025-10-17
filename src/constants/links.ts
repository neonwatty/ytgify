// External Links Constants
// Update WEBSTORE URLs once extension is published to Chrome Web Store

export const LINKS = {
  // Chrome Web Store (placeholder - update with actual extension ID when live)
  WEBSTORE_LISTING: 'https://github.com/neonwatty/ytgify', // Fallback to GitHub until published
  WEBSTORE_REVIEWS: 'https://github.com/neonwatty/ytgify#reviews', // Fallback to GitHub until published

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
  chrome.tabs.create({ url });
}

// Helper to get review link
export function getReviewLink(): string {
  return LINKS.WEBSTORE_REVIEWS;
}

// Helper to get GitHub star link
export function getGitHubStarLink(): string {
  return LINKS.GITHUB_REPO;
}

// Helper to get share link (for copying)
export function getShareLink(): string {
  return LINKS.WEBSTORE_LISTING;
}
