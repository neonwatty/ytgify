import { describe, it, expect } from '@jest/globals';
import https from 'https';
import { getDiscordLink, getReviewLink, getWaitlistLink } from '@/constants/links';
import { EXTERNAL_SURVEY_URL } from '@/constants/features';

// Helper to make HTTPS GET request with redirect following (bypasses mocked fetch)
function httpsGet(url: string, maxRedirects = 5): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      // Follow redirects (301, 302, 303, 307, 308)
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.destroy(); // Clean up current response
        if (maxRedirects <= 0) {
          resolve({ statusCode: res.statusCode, body: '' });
          return;
        }
        const redirectUrl = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).toString();
        httpsGet(redirectUrl, maxRedirects - 1).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        res.destroy(); // Clean up response
        resolve({ statusCode: res.statusCode || 0, body: data });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

describe('External Links', () => {
  describe('getDiscordLink', () => {
    it('should return the Discord invite URL', () => {
      const link = getDiscordLink();
      expect(link).toBe('https://discord.gg/ufrycqwb4R');
    });

    it('should return a valid Discord invite link format', () => {
      const link = getDiscordLink();
      expect(link).toMatch(/^https:\/\/discord\.gg\/[A-Za-z0-9]+$/);
    });

    it('should return a reachable Discord invite', async () => {
      const link = getDiscordLink();
      // Use Discord's API to validate the invite code
      const inviteCode = link.split('/').pop();
      const apiUrl = `https://discord.com/api/v10/invites/${inviteCode}`;
      const { statusCode, body } = await httpsGet(apiUrl);
      // Discord API returns 200 for valid invites, 404 for invalid/expired
      expect(statusCode).toBe(200);
      const data = JSON.parse(body) as { code: string };
      expect(data.code).toBe(inviteCode);
    }, 10000); // 10 second timeout for network request
  });

  describe('getReviewLink', () => {
    it('should return the Chrome Web Store review URL', () => {
      const link = getReviewLink();
      expect(link).toBe(
        'https://chromewebstore.google.com/detail/ytgify/dnljofakogbecppbkmnoffppkfdmpfje/reviews'
      );
    });

    it('should return a reachable Chrome Web Store page', async () => {
      const link = getReviewLink();
      const { statusCode } = await httpsGet(link);
      // Chrome Web Store returns 200 for valid extension pages
      expect(statusCode).toBe(200);
    }, 10000);
  });

  describe('EXTERNAL_SURVEY_URL', () => {
    it('should return the Google Forms survey URL', () => {
      expect(EXTERNAL_SURVEY_URL).toBe('https://forms.gle/evQ5EGdEhUxDhejU7');
    });

    it('should return a valid Google Forms link format', () => {
      expect(EXTERNAL_SURVEY_URL).toMatch(/^https:\/\/forms\.gle\/[A-Za-z0-9]+$/);
    });

    it('should return a reachable survey form', async () => {
      const { statusCode } = await httpsGet(EXTERNAL_SURVEY_URL);
      // Google Forms short URLs redirect to full form URL, then return 200
      expect(statusCode).toBe(200);
    }, 10000);
  });

  describe('getWaitlistLink', () => {
    it('should return the waitlist URL with UTM parameters', () => {
      const link = getWaitlistLink();
      expect(link).toBe(
        'https://ytgify.com/share?utm_source=extension&utm_medium=success_screen&utm_campaign=waitlist'
      );
    });

    it('should return a valid ytgify.com URL format', () => {
      const link = getWaitlistLink();
      expect(link).toMatch(/^https:\/\/ytgify\.com\/share\?/);
    });

    it('should include all required UTM parameters', () => {
      const link = getWaitlistLink();
      const url = new URL(link);
      expect(url.searchParams.get('utm_source')).toBe('extension');
      expect(url.searchParams.get('utm_medium')).toBe('success_screen');
      expect(url.searchParams.get('utm_campaign')).toBe('waitlist');
    });

    it('should return a reachable waitlist page', async () => {
      const link = getWaitlistLink();
      const { statusCode } = await httpsGet(link);
      // ytgify.com should return 200 for the share page
      expect(statusCode).toBe(200);
    }, 10000);
  });
});
