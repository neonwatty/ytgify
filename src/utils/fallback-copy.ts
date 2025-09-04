/**
 * Fallback Copy Utilities
 * Provides legacy clipboard copy methods for browsers without modern Clipboard API support
 */

import { logger } from '@/lib/logger';

export interface FallbackCopyResult {
  success: boolean;
  method: string;
  error?: string;
  details?: string;
}

export interface BrowserCompat {
  hasExecCommand: boolean;
  hasSelectionAPI: boolean;
  hasDataTransfer: boolean;
  supportsTouch: boolean;
  userAgent: string;
}

export class FallbackCopyService {
  private static browserCompat: BrowserCompat | null = null;

  /**
   * Initialize browser compatibility detection
   */
  public static initialize(): void {
    this.browserCompat = this.detectBrowserCompat();
    logger.debug('Fallback copy service initialized', { browserCompat: this.browserCompat });
  }

  /**
   * Attempt to copy text using legacy methods
   */
  public static async copyText(text: string): Promise<FallbackCopyResult> {
    if (!this.browserCompat) {
      this.initialize();
    }

    // Try multiple fallback methods in order of preference
    const methods = [
      () => this.copyViaExecCommand(text),
      () => this.copyViaSelectionAPI(text),
      () => this.copyViaTemporaryInput(text),
      () => this.copyViaTouchAPI(text)
    ];

    for (const method of methods) {
      try {
        const result = await method();
        if (result.success) {
          logger.info('Fallback copy successful', { method: result.method });
          return result;
        }
      } catch (error) {
        logger.debug('Fallback method failed', { error });
        continue;
      }
    }

    return {
      success: false,
      method: 'none',
      error: 'All fallback copy methods failed',
      details: 'Browser may not support clipboard operations'
    };
  }

  /**
   * Copy GIF as data URL using fallback methods
   */
  public static async copyGifAsDataUrl(gifBlob: Blob): Promise<FallbackCopyResult> {
    try {
      const dataUrl = await this.blobToDataUrl(gifBlob);
      return await this.copyText(dataUrl);
    } catch (error) {
      return {
        success: false,
        method: 'data-url-conversion',
        error: error instanceof Error ? error.message : 'Failed to convert blob to data URL'
      };
    }
  }

  /**
   * Create a shareable text representation of the GIF
   */
  public static async copyGifInfo(
    gifBlob: Blob,
    metadata?: {
      title?: string;
      description?: string;
      sourceUrl?: string;
    }
  ): Promise<FallbackCopyResult> {
    try {
      const sizeKB = Math.round(gifBlob.size / 1024);
      const info = [
        metadata?.title ? `Title: ${metadata.title}` : null,
        metadata?.description ? `Description: ${metadata.description}` : null,
        `Size: ${sizeKB} KB`,
        `Type: Animated GIF`,
        metadata?.sourceUrl ? `Source: ${metadata.sourceUrl}` : null,
        `Created: ${new Date().toLocaleString()}`
      ].filter(Boolean).join('\n');

      return await this.copyText(info);
    } catch (error) {
      return {
        success: false,
        method: 'gif-info',
        error: error instanceof Error ? error.message : 'Failed to create GIF info'
      };
    }
  }

  /**
   * Trigger download as ultimate fallback
   */
  public static triggerDownloadFallback(
    blob: Blob,
    filename: string = 'animated-gif'
  ): FallbackCopyResult {
    try {
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.gif`;
      
      // Handle different browser behaviors
      if (this.browserCompat?.supportsTouch) {
        // Mobile browsers may need different handling
        link.target = '_blank';
      }

      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up URL
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      logger.info('Download fallback triggered', { filename, size: blob.size });

      return {
        success: true,
        method: 'download-fallback',
        details: 'File download initiated'
      };

    } catch (error) {
      logger.error('Download fallback failed', { error });
      return {
        success: false,
        method: 'download-fallback',
        error: error instanceof Error ? error.message : 'Download failed'
      };
    }
  }

  /**
   * Get browser compatibility information
   */
  public static getBrowserCompat(): BrowserCompat | null {
    if (!this.browserCompat) {
      this.initialize();
    }
    return this.browserCompat;
  }

  /**
   * Check if any fallback method is available
   */
  public static isAnyMethodAvailable(): boolean {
    const compat = this.getBrowserCompat();
    return !!(
      compat?.hasExecCommand ||
      compat?.hasSelectionAPI ||
      compat?.hasDataTransfer
    );
  }

  // Private helper methods

  /**
   * Copy using document.execCommand (deprecated but widely supported)
   */
  private static copyViaExecCommand(text: string): Promise<FallbackCopyResult> {
    return new Promise((resolve) => {
      try {
        if (!this.browserCompat?.hasExecCommand) {
          resolve({
            success: false,
            method: 'execCommand',
            error: 'execCommand not supported'
          });
          return;
        }

        // Create temporary textarea
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.opacity = '0';
        
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        
        resolve({
          success,
          method: 'execCommand',
          error: success ? undefined : 'execCommand returned false'
        });

      } catch (error) {
        resolve({
          success: false,
          method: 'execCommand',
          error: error instanceof Error ? error.message : 'execCommand exception'
        });
      }
    });
  }

  /**
   * Copy using Selection API
   */
  private static copyViaSelectionAPI(text: string): Promise<FallbackCopyResult> {
    return new Promise((resolve) => {
      try {
        if (!this.browserCompat?.hasSelectionAPI) {
          resolve({
            success: false,
            method: 'selectionAPI',
            error: 'Selection API not supported'
          });
          return;
        }

        const range = document.createRange();
        const span = document.createElement('span');
        span.textContent = text;
        span.style.position = 'fixed';
        span.style.left = '-9999px';
        
        document.body.appendChild(span);
        range.selectNode(span);
        
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        
        const success = document.execCommand('copy');
        document.body.removeChild(span);
        
        resolve({
          success,
          method: 'selectionAPI',
          error: success ? undefined : 'Selection API copy failed'
        });

      } catch (error) {
        resolve({
          success: false,
          method: 'selectionAPI',
          error: error instanceof Error ? error.message : 'Selection API exception'
        });
      }
    });
  }

  /**
   * Copy via temporary input element (iOS Safari compatibility)
   */
  private static copyViaTemporaryInput(text: string): Promise<FallbackCopyResult> {
    return new Promise((resolve) => {
      try {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = text;
        input.style.position = 'fixed';
        input.style.left = '-9999px';
        input.style.opacity = '0';
        
        document.body.appendChild(input);
        input.focus();
        input.setSelectionRange(0, text.length);
        
        const success = document.execCommand('copy');
        document.body.removeChild(input);
        
        resolve({
          success,
          method: 'temporaryInput',
          error: success ? undefined : 'Temporary input copy failed'
        });

      } catch (error) {
        resolve({
          success: false,
          method: 'temporaryInput',
          error: error instanceof Error ? error.message : 'Temporary input exception'
        });
      }
    });
  }

  /**
   * Touch-specific copy method for mobile devices
   */
  private static copyViaTouchAPI(text: string): Promise<FallbackCopyResult> {
    return new Promise((resolve) => {
      try {
        if (!this.browserCompat?.supportsTouch) {
          resolve({
            success: false,
            method: 'touchAPI',
            error: 'Touch API not supported'
          });
          return;
        }

        // Create contenteditable div for touch selection
        const div = document.createElement('div');
        div.contentEditable = 'true';
        div.textContent = text;
        div.style.position = 'fixed';
        div.style.left = '-9999px';
        div.style.fontSize = '16px'; // Prevent zoom on iOS
        
        document.body.appendChild(div);
        
        // Select all text
        const range = document.createRange();
        range.selectNodeContents(div);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        
        const success = document.execCommand('copy');
        document.body.removeChild(div);
        
        resolve({
          success,
          method: 'touchAPI',
          error: success ? undefined : 'Touch API copy failed'
        });

      } catch (error) {
        resolve({
          success: false,
          method: 'touchAPI',
          error: error instanceof Error ? error.message : 'Touch API exception'
        });
      }
    });
  }

  /**
   * Detect browser compatibility features
   */
  private static detectBrowserCompat(): BrowserCompat {
    const userAgent = navigator.userAgent.toLowerCase();
    
    return {
      hasExecCommand: typeof document.execCommand === 'function',
      hasSelectionAPI: !!window.getSelection,
      hasDataTransfer: typeof DataTransfer !== 'undefined',
      supportsTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      userAgent
    };
  }

  /**
   * Convert blob to data URL
   */
  private static blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

// Initialize on module load
FallbackCopyService.initialize();

// Export convenience functions
export const copyTextFallback = (text: string) => FallbackCopyService.copyText(text);
export const copyGifFallback = (gifBlob: Blob) => FallbackCopyService.copyGifAsDataUrl(gifBlob);
export const downloadFallback = (blob: Blob, filename?: string) => 
  FallbackCopyService.triggerDownloadFallback(blob, filename);