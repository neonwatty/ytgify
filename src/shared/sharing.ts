/**
 * Sharing utilities for GIFs and related content
 * Provides various sharing mechanisms and URL generation
 */

import { logger } from '@/lib/logger';
import { GifData } from '@/types';

interface ShareOptions {
  title?: string;
  text?: string;
  url?: string;
  files?: File[];
}

interface ShareResult {
  success: boolean;
  error?: string;
  shared?: boolean;
}

interface ShareTarget {
  id: string;
  name: string;
  description: string;
  icon: string;
  supported: boolean;
}

class SharingService {
  /**
   * Check if the Web Share API is supported
   */
  static isWebShareSupported(): boolean {
    return typeof navigator !== 'undefined' && 'share' in navigator;
  }

  /**
   * Check if the Web Share API can share files
   */
  static canShareFiles(): boolean {
    return this.isWebShareSupported() && 'canShare' in navigator && typeof navigator.canShare === 'function';
  }

  /**
   * Share content using the Web Share API
   */
  static async shareWithWebAPI(options: ShareOptions): Promise<ShareResult> {
    try {
      if (!this.isWebShareSupported()) {
        return {
          success: false,
          error: 'Web Share API not supported'
        };
      }

      // Check if we can share the content
      if (options.files && !this.canShareFiles()) {
        return {
          success: false,
          error: 'File sharing not supported on this device'
        };
      }

      // Validate share data
      if (options.files && navigator.canShare && !navigator.canShare({ files: options.files })) {
        return {
          success: false,
          error: 'Selected files cannot be shared'
        };
      }

      await navigator.share(options);

      logger.info('Content shared successfully via Web Share API', {
        hasFiles: !!options.files,
        fileCount: options.files?.length,
        title: options.title
      });

      return { success: true, shared: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Handle user cancellation
      if (errorMessage.includes('AbortError') || errorMessage.includes('canceled')) {
        logger.debug('Share cancelled by user');
        return { success: true, shared: false };
      }

      logger.error('Web Share API failed', { error: errorMessage });
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Generate shareable URL for a GIF with metadata
   */
  static generateShareableURL(gifData: Partial<GifData>): string {
    const params = new URLSearchParams();
    
    if (gifData.title) {
      params.append('title', gifData.title);
    }
    
    if (gifData.metadata?.youtubeUrl) {
      params.append('source', gifData.metadata.youtubeUrl);
    }
    
    if (gifData.metadata?.startTime) {
      params.append('start', gifData.metadata.startTime.toString());
    }
    
    if (gifData.metadata?.endTime) {
      params.append('end', gifData.metadata.endTime.toString());
    }

    // For now, return a data URL or blob URL
    // In a real app, this would be a proper URL to view/download the GIF
    const baseUrl = 'https://ytgifmaker.app/share/';
    return baseUrl + (gifData.id || 'unknown') + (params.toString() ? '?' + params.toString() : '');
  }

  /**
   * Share GIF via different platforms
   */
  static async shareGif(
    gifBlob: Blob, 
    metadata: Partial<GifData>, 
    method: 'web-share' | 'url-copy' | 'download-link' = 'web-share'
  ): Promise<ShareResult> {
    try {
      switch (method) {
        case 'web-share': {
          if (this.canShareFiles()) {
            const file = new File([gifBlob], `${metadata.title || 'gif'}.gif`, {
              type: 'image/gif'
            });
            
            return await this.shareWithWebAPI({
              title: metadata.title || 'Animated GIF',
              text: metadata.description || 'Created with YouTube GIF Maker',
              files: [file]
            });
          } else {
            // Fallback to URL sharing
            const shareUrl = this.generateShareableURL(metadata);
            return await this.shareWithWebAPI({
              title: metadata.title || 'Animated GIF',
              text: metadata.description || 'Created with YouTube GIF Maker',
              url: shareUrl
            });
          }
        }
          
        case 'url-copy': {
          const { clipboard } = await import('./clipboard');
          const shareUrl = this.generateShareableURL(metadata);
          const result = await clipboard.copyTextToClipboard(shareUrl);
          return {
            success: result.success,
            error: result.error,
            shared: result.success
          };
        }
          
        case 'download-link': {
          this.downloadGif(gifBlob, metadata.title || 'gif');
          return { success: true, shared: true };
        }
          
        default:
          return {
            success: false,
            error: 'Unsupported sharing method'
          };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to share GIF', { error: errorMessage, method });
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Download GIF as file
   */
  static downloadGif(gifBlob: Blob, filename: string): void {
    try {
      const url = URL.createObjectURL(gifBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.gif`;
      
      // Append to body, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the URL
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      
      logger.info('GIF download initiated', { filename, fileSize: gifBlob.size });
    } catch (error) {
      logger.error('Failed to download GIF', { error, filename });
      throw error;
    }
  }

  /**
   * Get available share targets
   */
  static getShareTargets(): ShareTarget[] {
    return [
      {
        id: 'web-share',
        name: 'System Share',
        description: 'Share using device\'s native share menu',
        icon: '📱',
        supported: this.isWebShareSupported()
      },
      {
        id: 'url-copy',
        name: 'Copy Link',
        description: 'Copy shareable URL to clipboard',
        icon: '🔗',
        supported: true
      },
      {
        id: 'download',
        name: 'Download',
        description: 'Download GIF file to device',
        icon: '⬇️',
        supported: true
      }
    ];
  }

  /**
   * Generate social media share URLs
   */
  static generateSocialShareUrls(shareUrl: string, title: string, description?: string): Record<string, string> {
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedTitle = encodeURIComponent(title);
    const encodedText = encodeURIComponent(description || title);

    return {
      twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      reddit: `https://reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
      whatsapp: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
      telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
      email: `mailto:?subject=${encodedTitle}&body=${encodedText}%0A%0A${encodedUrl}`
    };
  }

  /**
   * Get sharing capabilities
   */
  static async getCapabilities(): Promise<{
    webShareSupported: boolean;
    canShareFiles: boolean;
    availableTargets: ShareTarget[];
  }> {
    return {
      webShareSupported: this.isWebShareSupported(),
      canShareFiles: this.canShareFiles(),
      availableTargets: this.getShareTargets()
    };
  }
}

// Export for convenience
const _sharing = SharingService;