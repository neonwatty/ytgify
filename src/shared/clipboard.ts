/**
 * Clipboard service for handling GIF data copying to system clipboard
 * Uses the Clipboard API with proper error handling and fallbacks
 */

import { logger } from '@/lib/logger';

export interface ClipboardResult {
  success: boolean;
  error?: string;
}

export class ClipboardService {
  /**
   * Check if clipboard API is supported
   */
  static isSupported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.write === 'function'
    );
  }

  /**
   * Copy GIF blob to clipboard
   * @param gifBlob - The GIF blob to copy
   * @param metadata - Optional metadata for logging
   */
  static async copyGifToClipboard(
    gifBlob: Blob, 
    metadata?: { title?: string; filename?: string }
  ): Promise<ClipboardResult> {
    try {
      if (!this.isSupported()) {
        return {
          success: false,
          error: 'Clipboard API not supported in this browser'
        };
      }

      // Ensure the blob is a GIF
      if (!gifBlob.type.includes('gif')) {
        return {
          success: false,
          error: 'Only GIF files can be copied to clipboard'
        };
      }

      // Create clipboard item with the GIF blob
      const clipboardItem = new ClipboardItem({
        [gifBlob.type]: gifBlob
      });

      await navigator.clipboard.write([clipboardItem]);

      logger.info('GIF copied to clipboard successfully', {
        fileSize: gifBlob.size,
        title: metadata?.title,
        filename: metadata?.filename
      });

      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('Failed to copy GIF to clipboard', {
        error: errorMessage,
        fileSize: gifBlob?.size,
        title: metadata?.title
      });

      // Provide user-friendly error messages
      let userErrorMessage = errorMessage;
      if (errorMessage.includes('NotAllowedError')) {
        userErrorMessage = 'Permission denied. Please allow clipboard access in your browser settings.';
      } else if (errorMessage.includes('DataError')) {
        userErrorMessage = 'The GIF data format is not supported for clipboard operations.';
      } else if (errorMessage.includes('NotSupportedError')) {
        userErrorMessage = 'Your browser does not support copying images to clipboard.';
      }

      return {
        success: false,
        error: userErrorMessage
      };
    }
  }

  /**
   * Copy text to clipboard (for fallback or sharing URLs)
   * @param text - The text to copy
   */
  static async copyTextToClipboard(text: string): Promise<ClipboardResult> {
    try {
      if (!this.isSupported()) {
        return {
          success: false,
          error: 'Clipboard API not supported in this browser'
        };
      }

      await navigator.clipboard.writeText(text);

      logger.info('Text copied to clipboard successfully', {
        textLength: text.length
      });

      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('Failed to copy text to clipboard', {
        error: errorMessage,
        textLength: text?.length
      });

      return {
        success: false,
        error: errorMessage.includes('NotAllowedError') 
          ? 'Permission denied. Please allow clipboard access in your browser settings.'
          : errorMessage
      };
    }
  }

  /**
   * Check clipboard permissions
   */
  static async checkPermissions(): Promise<{
    write: PermissionState;
    read?: PermissionState;
  }> {
    try {
      const writePermission = await navigator.permissions.query({ 
        name: 'clipboard-write' as PermissionName
      });

      // clipboard-read permission might not be available in all browsers
      let readPermission: PermissionStatus | undefined;
      try {
        readPermission = await navigator.permissions.query({ 
          name: 'clipboard-read' as PermissionName
        });
      } catch (error) {
        // Ignore - clipboard-read might not be supported
        logger.debug('Clipboard read permission check not supported');
      }

      return {
        write: writePermission.state,
        read: readPermission?.state
      };

    } catch (error) {
      logger.error('Failed to check clipboard permissions', { error });
      return { write: 'denied' as PermissionState };
    }
  }

  /**
   * Get clipboard capabilities and status
   */
  static async getCapabilities(): Promise<{
    supported: boolean;
    permissions: {
      write: PermissionState;
      read?: PermissionState;
    };
    supportsImages: boolean;
  }> {
    const supported = this.isSupported();
    const permissions = supported ? await this.checkPermissions() : { write: 'denied' as PermissionState };
    
    // ClipboardItem support indicates image copying capability
    const supportsImages = supported && typeof ClipboardItem !== 'undefined';

    return {
      supported,
      permissions,
      supportsImages
    };
  }
}

// Export for convenience
export const clipboard = ClipboardService;