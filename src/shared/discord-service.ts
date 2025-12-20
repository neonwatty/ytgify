// Discord webhook service for GIF uploads
import { logger } from '../lib/logger';

const DISCORD_FILE_SIZE_LIMIT = 8 * 1024 * 1024; // 8MB
const DISCORD_WEBHOOK_PATTERN = /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/;

export interface DiscordUploadResult {
  success: boolean;
  messageId?: string;
  channelId?: string;
  error?: string;
}

export class DiscordService {
  /**
   * Validate a Discord webhook URL format
   */
  static validateWebhookUrl(url: string): { valid: boolean; error?: string } {
    if (!url || typeof url !== 'string') {
      return { valid: false, error: 'Webhook URL is required' };
    }

    const trimmedUrl = url.trim();

    if (!trimmedUrl.startsWith('https://discord.com/api/webhooks/')) {
      return { valid: false, error: 'Invalid Discord webhook URL format' };
    }

    if (!DISCORD_WEBHOOK_PATTERN.test(trimmedUrl)) {
      return { valid: false, error: 'Invalid Discord webhook URL format' };
    }

    return { valid: true };
  }

  /**
   * Upload a GIF to Discord via webhook
   */
  static async uploadGif(
    webhookUrl: string,
    gifDataUrl: string,
    filename: string,
    message?: string
  ): Promise<DiscordUploadResult> {
    // Validate webhook URL
    const validation = this.validateWebhookUrl(webhookUrl);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Convert data URL to Blob
    let blob: Blob;
    try {
      blob = await this.dataUrlToBlob(gifDataUrl);
    } catch (error) {
      logger.error('[DiscordService] Failed to convert data URL to blob', { error });
      return { success: false, error: 'Failed to process GIF data' };
    }

    // Check file size limit
    if (blob.size > DISCORD_FILE_SIZE_LIMIT) {
      const sizeMB = (blob.size / (1024 * 1024)).toFixed(1);
      return {
        success: false,
        error: `GIF is too large (${sizeMB}MB). Discord limit is 8MB.`,
      };
    }

    // Build multipart form data
    const formData = new FormData();
    formData.append('file', blob, filename);

    if (message && message.trim()) {
      formData.append('content', message.trim());
    }

    try {
      // Add ?wait=true to get message data back (otherwise Discord returns 204 No Content)
      const urlWithWait = webhookUrl.includes('?') ? `${webhookUrl}&wait=true` : `${webhookUrl}?wait=true`;

      const response = await fetch(urlWithWait, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        logger.error('[DiscordService] Upload failed', {
          status: response.status,
          error: errorText,
        });

        if (response.status === 401 || response.status === 403) {
          return { success: false, error: 'Invalid webhook URL or permissions' };
        }
        if (response.status === 404) {
          return { success: false, error: 'Webhook not found. It may have been deleted.' };
        }
        if (response.status === 429) {
          return { success: false, error: 'Rate limited. Please try again later.' };
        }
        if (response.status === 413) {
          return { success: false, error: 'File too large for Discord' };
        }

        return { success: false, error: `Discord error (${response.status})` };
      }

      const data = await response.json();

      logger.info('[DiscordService] Upload successful', {
        messageId: data.id,
        channelId: data.channel_id,
      });

      return {
        success: true,
        messageId: data.id,
        channelId: data.channel_id,
      };
    } catch (error) {
      logger.error('[DiscordService] Network error', { error });

      if (error instanceof TypeError && error.message.includes('fetch')) {
        return { success: false, error: 'Network error. Check your connection.' };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  /**
   * Convert a data URL to a Blob
   */
  private static async dataUrlToBlob(dataUrl: string): Promise<Blob> {
    const response = await fetch(dataUrl);
    return response.blob();
  }
}

// Storage helpers for webhook settings

/**
 * Get the stored Discord webhook URL
 */
export async function getDiscordWebhookUrl(): Promise<string | null> {
  if (typeof chrome === 'undefined' || !chrome.storage?.sync) {
    return null;
  }

  try {
    const result = await chrome.storage.sync.get(['discordWebhookUrl']);
    return result.discordWebhookUrl || null;
  } catch (error) {
    logger.error('[DiscordService] Failed to get webhook URL', { error });
    return null;
  }
}

/**
 * Save a Discord webhook URL to storage
 */
export async function setDiscordWebhookUrl(url: string | null): Promise<{ success: boolean; error?: string }> {
  if (typeof chrome === 'undefined' || !chrome.storage?.sync) {
    return { success: false, error: 'Storage not available' };
  }

  if (url) {
    const validation = DiscordService.validateWebhookUrl(url);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
  }

  try {
    await chrome.storage.sync.set({ discordWebhookUrl: url || null });
    return { success: true };
  } catch (error) {
    logger.error('[DiscordService] Failed to save webhook URL', { error });
    return { success: false, error: 'Failed to save webhook URL' };
  }
}

/**
 * Record a successful Discord upload for analytics
 */
export async function recordDiscordUpload(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.sync) {
    return;
  }

  try {
    const result = await chrome.storage.sync.get(['discordUploadStats']);
    const stats = result.discordUploadStats || { count: 0, lastUsed: null };

    await chrome.storage.sync.set({
      discordUploadStats: {
        count: stats.count + 1,
        lastUsed: Date.now(),
      },
    });
  } catch (error) {
    logger.error('[DiscordService] Failed to record upload stats', { error });
  }
}
