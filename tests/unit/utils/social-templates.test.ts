import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  getTwitterTemplates,
  getDiscordTemplate,
  getRedditTemplate,
  generateTwitterShareUrl,
  copyToClipboard,
} from '@/utils/social-templates';

describe('Social Templates', () => {
  describe('getTwitterTemplates', () => {
    it('should return an array of templates', () => {
      const templates = getTwitterTemplates();

      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
    });

    it('should return templates with correct structure', () => {
      const templates = getTwitterTemplates();

      templates.forEach((template) => {
        expect(template).toHaveProperty('label');
        expect(template).toHaveProperty('text');
        expect(typeof template.label).toBe('string');
        expect(typeof template.text).toBe('string');
      });
    });

    it('should return templates with different lengths', () => {
      const templates = getTwitterTemplates();

      expect(templates.length).toBeGreaterThanOrEqual(3);
      const labels = templates.map((t) => t.label);
      expect(labels).toContain('Short');
      expect(labels).toContain('Medium');
      expect(labels).toContain('Long');
    });

    it('should have unique template labels', () => {
      const templates = getTwitterTemplates();
      const labels = templates.map((t) => t.label);
      const uniqueLabels = new Set(labels);

      expect(uniqueLabels.size).toBe(labels.length);
    });

    it('should have templates under Twitter character limit', () => {
      const templates = getTwitterTemplates();
      const MAX_TWEET_LENGTH = 280;

      templates.forEach((template) => {
        expect(template.text.length).toBeLessThanOrEqual(MAX_TWEET_LENGTH);
      });
    });

    it('should include YTGify in all templates', () => {
      const templates = getTwitterTemplates();

      templates.forEach((template) => {
        expect(template.text.toLowerCase()).toContain('ytgify');
      });
    });

    it('should be immutable (not modify original)', () => {
      const templates1 = getTwitterTemplates();
      const templates2 = getTwitterTemplates();

      expect(templates1).not.toBe(templates2); // Different array instances
      expect(templates1).toEqual(templates2); // Same content
    });

    it('should handle short template', () => {
      const templates = getTwitterTemplates();
      const shortTemplate = templates.find((t) => t.label === 'Short');

      expect(shortTemplate).toBeDefined();
      expect(shortTemplate!.text.length).toBeLessThan(150);
    });

    it('should handle medium template', () => {
      const templates = getTwitterTemplates();
      const mediumTemplate = templates.find((t) => t.label === 'Medium');

      expect(mediumTemplate).toBeDefined();
      expect(mediumTemplate!.text.length).toBeGreaterThan(100);
    });

    it('should handle long template', () => {
      const templates = getTwitterTemplates();
      const longTemplate = templates.find((t) => t.label === 'Long');

      expect(longTemplate).toBeDefined();
      expect(longTemplate!.text.length).toBeGreaterThan(150);
    });
  });

  describe('getDiscordTemplate', () => {
    it('should return a string template', () => {
      const template = getDiscordTemplate();

      expect(typeof template).toBe('string');
      expect(template.length).toBeGreaterThan(0);
    });

    it('should include YTGify', () => {
      const template = getDiscordTemplate();

      expect(template.toLowerCase()).toContain('ytgify');
    });

    it('should include relevant keywords', () => {
      const template = getDiscordTemplate();
      const lowerTemplate = template.toLowerCase();

      // Should mention GIF or YouTube
      expect(
        lowerTemplate.includes('gif') || lowerTemplate.includes('youtube')
      ).toBe(true);
    });

    it('should be suitable for Discord (no length restrictions)', () => {
      const template = getDiscordTemplate();

      // Discord messages can be up to 2000 characters
      expect(template.length).toBeLessThan(2000);
    });

    it('should return same template on multiple calls', () => {
      const template1 = getDiscordTemplate();
      const template2 = getDiscordTemplate();

      expect(template1).toBe(template2);
    });
  });

  describe('getRedditTemplate', () => {
    it('should return a string template', () => {
      const template = getRedditTemplate();

      expect(typeof template).toBe('string');
      expect(template.length).toBeGreaterThan(0);
    });

    it('should include YTGify', () => {
      const template = getRedditTemplate();

      expect(template.toLowerCase()).toContain('ytgify');
    });

    it('should include relevant keywords', () => {
      const template = getRedditTemplate();
      const lowerTemplate = template.toLowerCase();

      expect(
        lowerTemplate.includes('gif') || lowerTemplate.includes('youtube')
      ).toBe(true);
    });

    it('should be suitable for Reddit', () => {
      const template = getRedditTemplate();

      // Reddit posts can be quite long, but let's ensure reasonable length
      expect(template.length).toBeLessThan(10000);
    });

    it('should return same template on multiple calls', () => {
      const template1 = getRedditTemplate();
      const template2 = getRedditTemplate();

      expect(template1).toBe(template2);
    });
  });

  describe('generateTwitterShareUrl', () => {
    it('should generate valid Twitter share URL', () => {
      const text = 'Check out this cool tool!';
      const url = generateTwitterShareUrl(text);

      expect(url).toContain('https://twitter.com/intent/tweet');
      expect(url).toContain('text=');
    });

    it('should properly encode text parameter', () => {
      const text = 'Hello World! #test @user https://example.com';
      const url = generateTwitterShareUrl(text);

      // Should encode special characters
      expect(url).toContain('text=');
      expect(url).toContain('url=');
      expect(url).toContain('hashtags=');
    });

    it('should handle empty string', () => {
      const url = generateTwitterShareUrl('');

      expect(url).toContain('https://twitter.com/intent/tweet?text=');
      expect(url).toContain('url=');
      expect(url).toContain('hashtags=');
    });

    it('should handle special characters', () => {
      const text = 'Test & special < > characters!';
      const url = generateTwitterShareUrl(text);

      expect(url).toContain('text=');
      // URLSearchParams encodes spaces as + and special chars properly
      expect(url).toContain('Test+%26+special');
    });

    it('should handle Unicode characters', () => {
      const text = 'Testing emoji 🎉🚀 and Unicode 你好';
      const url = generateTwitterShareUrl(text);

      expect(url).toContain('text=');
      expect(url).toContain('url=');
      expect(url).toContain('hashtags=');
    });

    it('should handle long text', () => {
      const text = 'a'.repeat(300);
      const url = generateTwitterShareUrl(text);

      expect(url).toContain('text=');
      expect(url.length).toBeGreaterThan(100);
    });

    it('should handle newlines', () => {
      const text = 'Line 1\nLine 2\nLine 3';
      const url = generateTwitterShareUrl(text);

      expect(url).toContain('text=');
      expect(url).toContain('url=');
      expect(url).toContain('hashtags=');
    });

    it('should handle URLs in text', () => {
      const text = 'Check out https://github.com/neonwatty/ytgify';
      const url = generateTwitterShareUrl(text);

      expect(url).toContain('text=');
      expect(url).toContain('url=');
      expect(url).toContain('hashtags=');
    });

    it('should return different URLs for different texts', () => {
      const url1 = generateTwitterShareUrl('Text 1');
      const url2 = generateTwitterShareUrl('Text 2');

      expect(url1).not.toBe(url2);
    });

    it('should return same URL for same text', () => {
      const text = 'Same text';
      const url1 = generateTwitterShareUrl(text);
      const url2 = generateTwitterShareUrl(text);

      expect(url1).toBe(url2);
    });
  });

  describe('copyToClipboard', () => {
    let mockClipboard: any;

    beforeEach(() => {
      mockClipboard = {
        writeText: jest.fn(),
      };
      Object.defineProperty(global.navigator, 'clipboard', {
        value: mockClipboard,
        writable: true,
        configurable: true,
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should copy text to clipboard', async () => {
      mockClipboard.writeText.mockResolvedValue(undefined);

      const text = 'Text to copy';
      const result = await copyToClipboard(text);

      expect(result).toBe(true);
      expect(mockClipboard.writeText).toHaveBeenCalledWith(text);
    });

    it('should return false when clipboard API fails', async () => {
      mockClipboard.writeText.mockRejectedValue(new Error('Clipboard error'));

      const result = await copyToClipboard('test');

      expect(result).toBe(false);
    });

    it('should handle empty string', async () => {
      mockClipboard.writeText.mockResolvedValue(undefined);

      const result = await copyToClipboard('');

      expect(result).toBe(true);
      expect(mockClipboard.writeText).toHaveBeenCalledWith('');
    });

    it('should handle long text', async () => {
      mockClipboard.writeText.mockResolvedValue(undefined);

      const longText = 'a'.repeat(10000);
      const result = await copyToClipboard(longText);

      expect(result).toBe(true);
      expect(mockClipboard.writeText).toHaveBeenCalledWith(longText);
    });

    it('should handle special characters', async () => {
      mockClipboard.writeText.mockResolvedValue(undefined);

      const text = 'Special: < > & " \' \n \t';
      const result = await copyToClipboard(text);

      expect(result).toBe(true);
      expect(mockClipboard.writeText).toHaveBeenCalledWith(text);
    });

    it('should handle Unicode and emoji', async () => {
      mockClipboard.writeText.mockResolvedValue(undefined);

      const text = 'Unicode: 你好 🎉🚀';
      const result = await copyToClipboard(text);

      expect(result).toBe(true);
      expect(mockClipboard.writeText).toHaveBeenCalledWith(text);
    });

    it('should return false when clipboard is not available', async () => {
      Object.defineProperty(global.navigator, 'clipboard', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const result = await copyToClipboard('test');

      expect(result).toBe(false);
    });

    it('should handle permission denied error', async () => {
      mockClipboard.writeText.mockRejectedValue(
        new DOMException('Permission denied', 'NotAllowedError')
      );

      const result = await copyToClipboard('test');

      expect(result).toBe(false);
    });

    it('should handle multiple copy operations', async () => {
      mockClipboard.writeText.mockResolvedValue(undefined);

      await copyToClipboard('first');
      await copyToClipboard('second');
      const result = await copyToClipboard('third');

      expect(result).toBe(true);
      expect(mockClipboard.writeText).toHaveBeenCalledTimes(3);
      expect(mockClipboard.writeText).toHaveBeenLastCalledWith('third');
    });
  });

  describe('Integration Tests', () => {
    it('should generate valid Twitter URLs from templates', () => {
      const templates = getTwitterTemplates();

      templates.forEach((template) => {
        const url = generateTwitterShareUrl(template.text);

        expect(url).toContain('https://twitter.com/intent/tweet');
        expect(url).toContain('text=');
      });
    });

    it('should handle copying Discord template', async () => {
      const mockClipboard = {
        writeText: jest.fn().mockReturnValue(Promise.resolve()),
      };
      Object.defineProperty(global.navigator, 'clipboard', {
        value: mockClipboard,
        writable: true,
        configurable: true,
      });

      const template = getDiscordTemplate();
      const result = await copyToClipboard(template);

      expect(result).toBe(true);
      expect(mockClipboard.writeText).toHaveBeenCalledWith(template);
    });

    it('should handle copying Reddit template', async () => {
      const mockClipboard = {
        writeText: jest.fn().mockReturnValue(Promise.resolve()),
      };
      Object.defineProperty(global.navigator, 'clipboard', {
        value: mockClipboard,
        writable: true,
        configurable: true,
      });

      const template = getRedditTemplate();
      const result = await copyToClipboard(template);

      expect(result).toBe(true);
      expect(mockClipboard.writeText).toHaveBeenCalledWith(template);
    });

    it('should handle full sharing workflow for Twitter', () => {
      const templates = getTwitterTemplates();
      const shortTemplate = templates.find((t) => t.label === 'Short');

      expect(shortTemplate).toBeDefined();

      const url = generateTwitterShareUrl(shortTemplate!.text);

      expect(url).toContain('https://twitter.com/intent/tweet');
      expect(url).toContain('text=');
    });
  });
});
