/**
 * Tests for Discord webhook service
 */

import {
  DiscordService,
  getDiscordWebhookUrl,
  recordDiscordUpload
} from '@/shared/discord-service';

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Mock chrome storage
const mockStorage: Record<string, any> = {};

const chromeMock = {
  storage: {
    sync: {
      get: jest.fn((keys: string[], callback?: (result: Record<string, any>) => void) => {
        const result: Record<string, any> = {};
        for (const key of keys) {
          if (mockStorage[key] !== undefined) {
            result[key] = mockStorage[key];
          }
        }
        if (callback) {
          callback(result);
        }
        return Promise.resolve(result);
      }),
      set: jest.fn((items: Record<string, any>, callback?: () => void) => {
        Object.assign(mockStorage, items);
        if (callback) {
          callback();
        }
        return Promise.resolve();
      })
    }
  }
};

describe('DiscordService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear mock storage
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
    (global as any).chrome = chromeMock;
  });

  describe('validateWebhookUrl', () => {
    it('should validate correct Discord webhook URL', () => {
      const validUrl = 'https://discord.com/api/webhooks/1234567890/abcdefghijklmnop';
      const result = DiscordService.validateWebhookUrl(validUrl);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate webhook URL with dashes in token', () => {
      const validUrl = 'https://discord.com/api/webhooks/1234567890/abc-def-123_xyz';
      const result = DiscordService.validateWebhookUrl(validUrl);
      expect(result.valid).toBe(true);
    });

    it('should reject empty URL', () => {
      const result = DiscordService.validateWebhookUrl('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Webhook URL is required');
    });

    it('should reject null URL', () => {
      const result = DiscordService.validateWebhookUrl(null as any);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Webhook URL is required');
    });

    it('should reject non-Discord URL', () => {
      const result = DiscordService.validateWebhookUrl('https://example.com/webhook');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid Discord webhook URL format');
    });

    it('should reject HTTP URL (non-HTTPS)', () => {
      const result = DiscordService.validateWebhookUrl('http://discord.com/api/webhooks/123/abc');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid Discord webhook URL format');
    });

    it('should reject malformed webhook URL without ID', () => {
      const result = DiscordService.validateWebhookUrl('https://discord.com/api/webhooks/');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid Discord webhook URL format');
    });

    it('should reject URL with non-numeric webhook ID', () => {
      const result = DiscordService.validateWebhookUrl('https://discord.com/api/webhooks/abc/token');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid Discord webhook URL format');
    });

    it('should trim whitespace from URL', () => {
      const validUrl = '  https://discord.com/api/webhooks/1234567890/token  ';
      const result = DiscordService.validateWebhookUrl(validUrl);
      expect(result.valid).toBe(true);
    });
  });

  describe('uploadGif', () => {
    // Note: Full upload tests require browser APIs (Blob, FormData with File support)
    // that don't work well in jsdom. These are tested in E2E tests.
    // Here we test what we can in the unit test environment.

    it('should reject invalid webhook URL before making any request', async () => {
      const result = await DiscordService.uploadGif(
        'https://invalid.com/webhook',
        'data:image/gif;base64,test',
        'test.gif'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid Discord webhook URL format');
    });

    it('should reject empty webhook URL', async () => {
      const result = await DiscordService.uploadGif(
        '',
        'data:image/gif;base64,test',
        'test.gif'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Webhook URL is required');
    });
  });
});

describe('Storage helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
    (global as any).chrome = chromeMock;
  });

  describe('getDiscordWebhookUrl', () => {
    it('should return stored webhook URL', async () => {
      mockStorage.discordWebhookUrl = 'https://discord.com/api/webhooks/123/abc';

      const url = await getDiscordWebhookUrl();
      expect(url).toBe('https://discord.com/api/webhooks/123/abc');
    });

    it('should return null when no URL stored', async () => {
      const url = await getDiscordWebhookUrl();
      expect(url).toBeNull();
    });

    it('should return null when chrome is undefined', async () => {
      (global as any).chrome = undefined;

      const url = await getDiscordWebhookUrl();
      expect(url).toBeNull();
    });
  });

  describe('recordDiscordUpload', () => {
    it('should increment upload count', async () => {
      mockStorage.discordUploadStats = { count: 5, lastUsed: 1000 };

      await recordDiscordUpload();

      expect(mockStorage.discordUploadStats.count).toBe(6);
      expect(mockStorage.discordUploadStats.lastUsed).toBeGreaterThan(1000);
    });

    it('should initialize stats if not present', async () => {
      await recordDiscordUpload();

      expect(mockStorage.discordUploadStats.count).toBe(1);
      expect(mockStorage.discordUploadStats.lastUsed).toBeDefined();
    });

    it('should not throw when chrome is undefined', async () => {
      (global as any).chrome = undefined;

      // Should not throw
      await expect(recordDiscordUpload()).resolves.toBeUndefined();
    });
  });
});
