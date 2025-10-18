import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  LINKS,
  getReviewLink,
  getGitHubStarLink,
  openExternalLink,
} from '@/constants/links';

// Mock chrome.tabs
global.chrome = {
  tabs: {
    create: jest.fn(() => Promise.resolve({})),
  },
} as any;

describe('Links Constants', () => {
  describe('LINKS object', () => {
    it('should have all required link properties', () => {
      expect(LINKS).toHaveProperty('WEBSTORE_LISTING');
      expect(LINKS).toHaveProperty('WEBSTORE_REVIEWS');
      expect(LINKS).toHaveProperty('GITHUB_REPO');
      expect(LINKS).toHaveProperty('GITHUB_ISSUES');
      expect(LINKS).toHaveProperty('TWITTER_PROFILE');
    });

    it('should have valid URL formats', () => {
      const urlPattern = /^https?:\/\/.+/;

      expect(LINKS.WEBSTORE_LISTING).toMatch(urlPattern);
      expect(LINKS.WEBSTORE_REVIEWS).toMatch(urlPattern);
      expect(LINKS.GITHUB_REPO).toMatch(urlPattern);
      expect(LINKS.GITHUB_ISSUES).toMatch(urlPattern);
    });

    it('should have GitHub URLs', () => {
      expect(LINKS.GITHUB_REPO).toContain('github.com');
      expect(LINKS.GITHUB_ISSUES).toContain('github.com');
    });

    it('should have Twitter profile URL', () => {
      expect(typeof LINKS.TWITTER_PROFILE).toBe('string');
      expect(LINKS.TWITTER_PROFILE.length).toBeGreaterThan(0);
      expect(LINKS.TWITTER_PROFILE).toContain('x.com');
    });

    it('should have consistent GitHub repository', () => {
      expect(LINKS.GITHUB_ISSUES).toContain(LINKS.GITHUB_REPO.replace('https://github.com/', ''));
    });

    it('should not have trailing slashes', () => {
      Object.values(LINKS).forEach((link) => {
        if (typeof link === 'string' && link.startsWith('http')) {
          expect(link.endsWith('/')).toBe(false);
        }
      });
    });

    it('should be readonly in TypeScript', () => {
      // Note: `as const` makes it readonly in TypeScript at compile time
      // At runtime, it's not frozen, so we just verify the const declaration exists
      expect(LINKS).toBeDefined();
      expect(typeof LINKS).toBe('object');
    });

    it('should have secure HTTPS URLs', () => {
      expect(LINKS.WEBSTORE_LISTING).toMatch(/^https:\/\//);
      expect(LINKS.WEBSTORE_REVIEWS).toMatch(/^https:\/\//);
      expect(LINKS.GITHUB_REPO).toMatch(/^https:\/\//);
      expect(LINKS.GITHUB_ISSUES).toMatch(/^https:\/\//);
    });
  });

  describe('getReviewLink', () => {
    it('should return webstore reviews URL', () => {
      const url = getReviewLink();

      expect(url).toBe(LINKS.WEBSTORE_REVIEWS);
    });

    it('should return a valid URL', () => {
      const url = getReviewLink();

      expect(url).toMatch(/^https?:\/\/.+/);
    });

    it('should return same URL on multiple calls', () => {
      const url1 = getReviewLink();
      const url2 = getReviewLink();

      expect(url1).toBe(url2);
    });

    it('should be a function', () => {
      expect(typeof getReviewLink).toBe('function');
    });

    it('should not require parameters', () => {
      expect(getReviewLink.length).toBe(0);
    });
  });

  describe('getGitHubStarLink', () => {
    it('should return GitHub repository URL', () => {
      const url = getGitHubStarLink();

      expect(url).toBe(LINKS.GITHUB_REPO);
    });

    it('should return a valid GitHub URL', () => {
      const url = getGitHubStarLink();

      expect(url).toContain('github.com');
      expect(url).toMatch(/^https:\/\//);
    });

    it('should return same URL on multiple calls', () => {
      const url1 = getGitHubStarLink();
      const url2 = getGitHubStarLink();

      expect(url1).toBe(url2);
    });

    it('should be a function', () => {
      expect(typeof getGitHubStarLink).toBe('function');
    });

    it('should not require parameters', () => {
      expect(getGitHubStarLink.length).toBe(0);
    });
  });

  describe('LINKS.GITHUB_ISSUES', () => {
    it('should be a valid GitHub issues URL', () => {
      expect(LINKS.GITHUB_ISSUES).toContain('github.com');
      expect(LINKS.GITHUB_ISSUES).toMatch(/^https:\/\//);
      expect(LINKS.GITHUB_ISSUES).toContain('/issues');
    });

    it('should point to correct repository', () => {
      expect(LINKS.GITHUB_ISSUES).toContain('neonwatty/ytgify');
    });
  });

  describe('LINKS.TWITTER_PROFILE', () => {
    it('should be a valid Twitter/X URL', () => {
      expect(LINKS.TWITTER_PROFILE).toMatch(/^https:\/\//);
      expect(LINKS.TWITTER_PROFILE).toContain('x.com');
    });

    it('should point to correct profile', () => {
      expect(LINKS.TWITTER_PROFILE).toContain('neonwatty');
    });

    it('should not include @ symbol in URL', () => {
      // URL should not have @ after the domain
      const afterDomain = LINKS.TWITTER_PROFILE.split('x.com')[1];
      expect(afterDomain).not.toContain('@');
    });
  });

  describe('openExternalLink', () => {
    let originalChrome: any;
    let originalWindow: any;

    beforeEach(() => {
      jest.clearAllMocks();

      // Save originals
      originalChrome = global.chrome;
      originalWindow = global.window;

      // Reset to default mock state
      global.chrome = {
        tabs: {
          create: jest.fn(() => Promise.resolve({})),
        },
      } as any;
    });

    afterEach(() => {
      // Restore originals
      global.chrome = originalChrome;
      global.window = originalWindow;
    });

    it('should call chrome.tabs.create with URL', () => {
      const url = 'https://example.com';

      openExternalLink(url);

      expect(chrome.tabs.create).toHaveBeenCalledWith({ url });
    });

    it('should open GitHub repository', () => {
      openExternalLink(LINKS.GITHUB_REPO);

      expect(chrome.tabs.create).toHaveBeenCalledWith({ url: LINKS.GITHUB_REPO });
    });

    it('should open review link', () => {
      const reviewLink = getReviewLink();

      openExternalLink(reviewLink);

      expect(chrome.tabs.create).toHaveBeenCalledWith({ url: reviewLink });
    });

    it('should handle multiple calls', () => {
      openExternalLink('https://example1.com');
      openExternalLink('https://example2.com');
      openExternalLink('https://example3.com');

      expect(chrome.tabs.create).toHaveBeenCalledTimes(3);
    });

    it('should handle empty string', () => {
      openExternalLink('');

      expect(chrome.tabs.create).toHaveBeenCalledWith({ url: '' });
    });

    it('should handle special characters in URL', () => {
      const url = 'https://example.com/path?query=value&other=test';

      openExternalLink(url);

      expect(chrome.tabs.create).toHaveBeenCalledWith({ url });
    });

    it('should handle URLs with hash fragments', () => {
      const url = 'https://example.com/page#section';

      openExternalLink(url);

      expect(chrome.tabs.create).toHaveBeenCalledWith({ url });
    });

    it('should handle data URLs', () => {
      const url = 'data:text/plain,Hello';

      openExternalLink(url);

      expect(chrome.tabs.create).toHaveBeenCalledWith({ url });
    });

    it('should handle blob URLs', () => {
      const url = 'blob:https://example.com/test';

      openExternalLink(url);

      expect(chrome.tabs.create).toHaveBeenCalledWith({ url });
    });

    it('should be a function', () => {
      expect(typeof openExternalLink).toBe('function');
    });

    it('should require one parameter', () => {
      expect(openExternalLink.length).toBe(1);
    });

    it('should not throw on invalid URL', () => {
      expect(() => {
        openExternalLink('not-a-valid-url');
      }).not.toThrow();
    });

    it('should fallback to window.open when chrome.tabs.create fails', async () => {
      const url = 'https://example.com';
      const mockWindowOpen = jest.fn();

      // Mock chrome.tabs.create to reject
      (chrome.tabs.create as jest.Mock).mockReturnValueOnce(Promise.reject(new Error('Failed')));

      // Mock window.open on existing window object
      window.open = mockWindowOpen as any;

      openExternalLink(url);

      // Wait for promise to reject and catch handler to run
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockWindowOpen).toHaveBeenCalledWith(url, '_blank', 'noopener,noreferrer');
    });

    it('should use window.open when chrome.tabs is not available', () => {
      const url = 'https://example.com';
      const mockWindowOpen = jest.fn();

      // Remove chrome.tabs
      global.chrome = {} as any;

      // Mock window.open on existing window object
      window.open = mockWindowOpen as any;

      openExternalLink(url);

      expect(mockWindowOpen).toHaveBeenCalledWith(url, '_blank', 'noopener,noreferrer');
    });

    it('should use window.open when chrome is undefined', () => {
      const url = 'https://example.com';
      const mockWindowOpen = jest.fn();

      // Remove chrome completely
      (global as any).chrome = undefined;

      // Mock window.open on existing window object
      window.open = mockWindowOpen as any;

      openExternalLink(url);

      expect(mockWindowOpen).toHaveBeenCalledWith(url, '_blank', 'noopener,noreferrer');
    });

    it('should handle case when neither chrome.tabs nor window is available', () => {
      // Remove both
      (global as any).chrome = undefined;
      (global as any).window = undefined;

      // Should not throw
      expect(() => {
        openExternalLink('https://example.com');
      }).not.toThrow();
    });
  });

  describe('Integration Tests', () => {
    beforeEach(() => {
      jest.clearAllMocks();

      // Ensure chrome.tabs is available
      global.chrome = {
        tabs: {
          create: jest.fn(() => Promise.resolve({})),
        },
      } as any;
    });

    it('should open review link using helper function', () => {
      const url = getReviewLink();
      openExternalLink(url);

      expect(chrome.tabs.create).toHaveBeenCalledWith({ url: LINKS.WEBSTORE_REVIEWS });
    });

    it('should open GitHub star link using helper function', () => {
      const url = getGitHubStarLink();
      openExternalLink(url);

      expect(chrome.tabs.create).toHaveBeenCalledWith({ url: LINKS.GITHUB_REPO });
    });

    it('should open GitHub issues link directly', () => {
      openExternalLink(LINKS.GITHUB_ISSUES);

      expect(chrome.tabs.create).toHaveBeenCalledWith({ url: LINKS.GITHUB_ISSUES });
    });

    it('should open Twitter profile link directly', () => {
      openExternalLink(LINKS.TWITTER_PROFILE);

      expect(chrome.tabs.create).toHaveBeenCalledWith({
        url: LINKS.TWITTER_PROFILE,
      });
    });

    it('should handle complete sharing workflow', () => {
      // Rate
      openExternalLink(getReviewLink());

      // Star on GitHub
      openExternalLink(getGitHubStarLink());

      // Follow on Twitter
      openExternalLink(LINKS.TWITTER_PROFILE);

      expect(chrome.tabs.create).toHaveBeenCalledTimes(3);
    });
  });

  describe('URL Validation', () => {
    it('should have working GitHub repository URL structure', () => {
      const url = LINKS.GITHUB_REPO;

      expect(url).toMatch(/^https:\/\/github\.com\/[^/]+\/[^/]+$/);
    });

    it('should have working GitHub issues URL structure', () => {
      const url = LINKS.GITHUB_ISSUES;

      expect(url).toMatch(/^https:\/\/github\.com\/[^/]+\/[^/]+/);
    });

    it('should have consistent repository name across URLs', () => {
      const repoMatch = LINKS.GITHUB_REPO.match(/github\.com\/([^/]+\/[^/]+)/);
      const issuesMatch = LINKS.GITHUB_ISSUES.match(/github\.com\/([^/]+\/[^/]+)/);

      expect(repoMatch).toBeDefined();
      expect(issuesMatch).toBeDefined();
      expect(repoMatch![1]).toBe(issuesMatch![1]);
    });
  });
});
