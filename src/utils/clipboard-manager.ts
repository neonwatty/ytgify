/**
 * Clipboard Manager - Utility layer for clipboard operations
 * Provides a simplified interface for copying GIF data with comprehensive fallback support
 */

import { ClipboardService } from '@/shared/clipboard';
import { logger } from '@/lib/logger';

export interface ClipboardOperationResult {
  success: boolean;
  method: 'native' | 'fallback' | 'failed';
  error?: string;
  message?: string;
}

export interface ClipboardCapabilities {
  supportsNativeAPI: boolean;
  supportsImages: boolean;
  requiresUserActivation: boolean;
  browserName: string;
}

export class ClipboardManager {
  private static instance: ClipboardManager;
  private capabilities: ClipboardCapabilities | null = null;

  private constructor() {}

  public static getInstance(): ClipboardManager {
    if (!ClipboardManager.instance) {
      ClipboardManager.instance = new ClipboardManager();
    }
    return ClipboardManager.instance;
  }

  /**
   * Initialize and detect clipboard capabilities
   */
  public async initialize(): Promise<void> {
    this.capabilities = await this.detectCapabilities();
    logger.info('Clipboard manager initialized', { capabilities: this.capabilities });
  }

  /**
   * Get current clipboard capabilities
   */
  public getCapabilities(): ClipboardCapabilities | null {
    return this.capabilities;
  }

  /**
   * Copy GIF data to clipboard with automatic fallback
   * @param gifBlob - The GIF blob to copy
   * @param options - Additional options for copying
   */
  public async copyGif(
    gifBlob: Blob,
    options: {
      title?: string;
      filename?: string;
      fallbackToDownload?: boolean;
      userActivated?: boolean;
    } = {}
  ): Promise<ClipboardOperationResult> {
    const { title, filename, fallbackToDownload = true } = options;

    // Ensure capabilities are detected
    if (!this.capabilities) {
      await this.initialize();
    }

    logger.debug('Starting clipboard copy operation', {
      blobSize: gifBlob.size,
      title,
      capabilities: this.capabilities
    });

    try {
      // Attempt native clipboard API first
      if (this.capabilities?.supportsImages && this.capabilities?.supportsNativeAPI) {
        const result = await ClipboardService.copyGifToClipboard(gifBlob, { title, filename });
        
        if (result.success) {
          return {
            success: true,
            method: 'native',
            message: 'GIF copied to clipboard successfully'
          };
        }

        logger.warn('Native clipboard API failed, trying fallback', { error: result.error });
      }

      // Try fallback method - copy as URL or text
      if (fallbackToDownload) {
        const fallbackResult = await this.copyAsFallback(gifBlob, { title, filename });
        if (fallbackResult.success) {
          return fallbackResult;
        }
      }

      // If all methods fail
      return {
        success: false,
        method: 'failed',
        error: 'All clipboard methods failed',
        message: 'Unable to copy GIF to clipboard'
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Clipboard copy operation failed', { error: errorMessage });

      return {
        success: false,
        method: 'failed',
        error: errorMessage,
        message: 'Clipboard operation encountered an error'
      };
    }
  }

  /**
   * Copy text data to clipboard (useful for URLs or metadata)
   */
  public async copyText(text: string): Promise<ClipboardOperationResult> {
    try {
      const result = await ClipboardService.copyTextToClipboard(text);
      
      if (result.success) {
        return {
          success: true,
          method: 'native',
          message: 'Text copied to clipboard successfully'
        };
      }

      // Fallback to legacy method
      const fallbackSuccess = await this.copyTextFallback(text);
      if (fallbackSuccess) {
        return {
          success: true,
          method: 'fallback',
          message: 'Text copied using fallback method'
        };
      }

      return {
        success: false,
        method: 'failed',
        error: result.error || 'Text copy failed',
        message: 'Unable to copy text to clipboard'
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        method: 'failed',
        error: errorMessage,
        message: 'Text copy operation failed'
      };
    }
  }

  /**
   * Check if clipboard operation is likely to succeed
   */
  public canCopyToClipboard(): boolean {
    return this.capabilities?.supportsNativeAPI ?? false;
  }

  /**
   * Check if GIF copying is supported
   */
  public canCopyImages(): boolean {
    return this.capabilities?.supportsImages ?? false;
  }

  /**
   * Detect browser capabilities for clipboard operations
   */
  private async detectCapabilities(): Promise<ClipboardCapabilities> {
    const capabilities = await ClipboardService.getCapabilities();
    
    // Detect browser
    const userAgent = navigator.userAgent.toLowerCase();
    let browserName = 'unknown';
    if (userAgent.includes('chrome')) browserName = 'chrome';
    else if (userAgent.includes('firefox')) browserName = 'firefox';
    else if (userAgent.includes('safari')) browserName = 'safari';
    else if (userAgent.includes('edge')) browserName = 'edge';

    // Determine if user activation is required (Firefox/Safari typically require it)
    const requiresUserActivation = browserName === 'firefox' || browserName === 'safari';

    return {
      supportsNativeAPI: capabilities.supported,
      supportsImages: capabilities.supportsImages,
      requiresUserActivation,
      browserName
    };
  }

  /**
   * Fallback method for copying GIF (creates download link or data URL)
   */
  private async copyAsFallback(
    gifBlob: Blob,
    options: { title?: string; filename?: string }
  ): Promise<ClipboardOperationResult> {
    try {
      // Create a data URL for the GIF
      const dataUrl = await this.blobToDataUrl(gifBlob);
      
      // Try to copy the data URL as text
      const textResult = await this.copyText(dataUrl);
      
      if (textResult.success) {
        return {
          success: true,
          method: 'fallback',
          message: 'GIF data URL copied to clipboard (paste to use)'
        };
      }

      // Last resort: trigger download
      this.triggerDownload(gifBlob, options.filename || options.title || 'gif');
      
      return {
        success: true,
        method: 'fallback',
        message: 'GIF download started (clipboard not available)'
      };

    } catch (error) {
      logger.error('Fallback copy method failed', { error });
      return {
        success: false,
        method: 'failed',
        error: error instanceof Error ? error.message : 'Fallback failed'
      };
    }
  }

  /**
   * Legacy text copy using execCommand
   */
  private async copyTextFallback(text: string): Promise<boolean> {
    try {
      // Create temporary textarea
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      
      document.body.appendChild(textarea);
      textarea.select();
      
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      
      return success;
    } catch {
      return false;
    }
  }

  /**
   * Convert blob to data URL
   */
  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Trigger file download as last resort
   */
  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.gif`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

// Export singleton instance
export const clipboardManager = ClipboardManager.getInstance();