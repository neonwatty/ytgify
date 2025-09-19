import { logger } from '@/lib/logger';
import { youTubeDetector } from './youtube-detector';
import { createNativeYouTubeButton, updateButtonState } from './youtube-button';

export interface PlayerSizeInfo {
  width: number;
  height: number;
  aspectRatio: number;
  isCompact: boolean;
  isTheater: boolean;
  isFullscreen: boolean;
}

interface ButtonPositionConfig {
  selector: string;
  position: 'before' | 'after' | 'prepend' | 'append';
  priority: number;
  requiredMinWidth?: number;
  requiredMinHeight?: number;
  theme?: 'light' | 'dark' | 'auto';
}

type ButtonStateChangeCallback = (isActive: boolean, playerInfo: PlayerSizeInfo) => void;
type PlayerSizeChangeCallback = (sizeInfo: PlayerSizeInfo) => void;

export class YouTubePlayerIntegration {
  private static instance: YouTubePlayerIntegration;
  private button: HTMLButtonElement | null = null;
  private isActive = false;
  private currentPlayerInfo: PlayerSizeInfo | null = null;
  private stateChangeCallbacks: Set<ButtonStateChangeCallback> = new Set();
  private sizeChangeCallbacks: Set<PlayerSizeChangeCallback> = new Set();
  private resizeObserver: ResizeObserver | null = null;
  private clickHandler: ((event: Event) => void) | null = null;
  private injectionRetryCount = 0;
  private maxRetries = 10;

  // Button position configurations in priority order
  private positionConfigs: ButtonPositionConfig[] = [
    {
      selector: '.ytp-right-controls',
      position: 'prepend',
      priority: 1,
      requiredMinWidth: 480,
      theme: 'auto'
    },
    {
      selector: '.ytp-chrome-controls .ytp-right-controls',
      position: 'prepend', 
      priority: 2,
      requiredMinWidth: 320,
      theme: 'auto'
    },
    {
      selector: '.ytp-chrome-bottom .ytp-chrome-controls .ytp-right-controls',
      position: 'prepend',
      priority: 3,
      requiredMinWidth: 200,
      theme: 'auto'
    }
  ];

  private constructor() {
    this.setupResizeObserver();
    this.setupNavigationListener();
  }

  public static getInstance(): YouTubePlayerIntegration {
    if (!YouTubePlayerIntegration.instance) {
      YouTubePlayerIntegration.instance = new YouTubePlayerIntegration();
    }
    return YouTubePlayerIntegration.instance;
  }

  // Public API methods
  public injectButton(clickHandler: (event: Event) => void): boolean {
    this.clickHandler = clickHandler;
    this.injectionRetryCount = 0;
    return this.attemptButtonInjectionWithRetry();
  }

  private attemptButtonInjectionWithRetry(): boolean {
    const result = this.attemptButtonInjection();
    
    if (!result && this.injectionRetryCount < this.maxRetries) {
      this.injectionRetryCount++;
      logger.info(`[PlayerIntegration] Retry injection attempt ${this.injectionRetryCount}/${this.maxRetries}`);
      
      // Retry after a delay
      setTimeout(() => {
        this.attemptButtonInjectionWithRetry();
      }, 1000);
      
      return false;
    }
    
    if (result) {
      logger.info('[PlayerIntegration] Button injection successful');
      this.injectionRetryCount = 0;
    } else {
      logger.error('[PlayerIntegration] Failed to inject button after all retries');
    }
    
    return result;
  }

  public removeButton(): void {
    if (this.button && this.button.parentNode) {
      this.button.parentNode.removeChild(this.button);
    }
    this.button = null;
  }

  public hasButton(): boolean {
    return this.button !== null && this.button.parentNode !== null;
  }

  public setButtonState(isActive: boolean): void {
    if (this.isActive !== isActive) {
      this.isActive = isActive;
      
      if (this.button) {
        updateButtonState(this.button, isActive);
      }

      // Notify callbacks of state change
      if (this.currentPlayerInfo) {
        this.stateChangeCallbacks.forEach(callback => {
          try {
            callback(isActive, this.currentPlayerInfo!);
          } catch (error) {
            logger.error('[PlayerIntegration] Error in state change callback', { error });
          }
        });
      }
    }
  }

  public onStateChange(callback: ButtonStateChangeCallback): () => void {
    this.stateChangeCallbacks.add(callback);
    return () => {
      this.stateChangeCallbacks.delete(callback);
    };
  }

  public onSizeChange(callback: PlayerSizeChangeCallback): () => void {
    this.sizeChangeCallbacks.add(callback);
    return () => {
      this.sizeChangeCallbacks.delete(callback);
    };
  }

  // Button injection logic
  private attemptButtonInjection(): boolean {
    if (this.button) {
      this.removeButton();
    }

    // Wait for player to be available
    const player = this.waitForPlayer();
    if (!player) {
      logger.warn('[PlayerIntegration] Player not found yet');
      return false;
    }

    const playerInfo = this.detectPlayerInfo();
    if (!playerInfo) {
      logger.warn('[PlayerIntegration] Could not detect player info');
      return false;
    }

    this.currentPlayerInfo = playerInfo;

    // Try position configurations in priority order
    for (const config of this.positionConfigs) {
      if (this.tryInjectAtPosition(config, playerInfo)) {
        logger.info('[PlayerIntegration] Button injected successfully', {
          selector: config.selector,
          position: config.position,
          playerInfo
        });
        return true;
      }
    }

    logger.warn('[PlayerIntegration] Failed to inject button at any position');
    return false;
  }

  private waitForPlayer(): HTMLElement | null {
    // Try multiple selectors to find player
    const selectors = [
      '#movie_player',
      '.html5-video-player',
      '.video-stream',
      '#player-container #movie_player'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector) as HTMLElement;
      if (element) {
        logger.info(`[PlayerIntegration] Player found with selector: ${selector}`);
        return element;
      }
    }

    return null;
  }

  private tryInjectAtPosition(config: ButtonPositionConfig, playerInfo: PlayerSizeInfo): boolean {
    // Check size requirements
    if (config.requiredMinWidth && playerInfo.width < config.requiredMinWidth) {
      return false;
    }
    if (config.requiredMinHeight && playerInfo.height < config.requiredMinHeight) {
      return false;
    }

    // Find target container
    const container = document.querySelector(config.selector) as HTMLElement;
    if (!container) {
      logger.debug(`[PlayerIntegration] Container not found: ${config.selector}`);
      return false;
    }

    try {
      // Create button with appropriate styling
      this.button = createNativeYouTubeButton({
        isActive: this.isActive,
        onClick: this.clickHandler!,
        className: this.getButtonClassName(config, playerInfo),
        ariaLabel: this.isActive ? 'Stop creating GIF' : 'Create GIF from video'
      });

      // Insert button according to position config
      this.insertButtonAtPosition(this.button, container, config.position);

      // Apply theme-specific styling
      this.applyThemeStyles(this.button, config.theme || 'auto');

      logger.info(`[PlayerIntegration] Button inserted at: ${config.selector}`);
      return true;
    } catch (error) {
      logger.error('[PlayerIntegration] Error injecting button', { error, config });
      return false;
    }
  }

  private insertButtonAtPosition(
    button: HTMLButtonElement, 
    container: HTMLElement, 
    position: 'before' | 'after' | 'prepend' | 'append'
  ): void {
    switch (position) {
      case 'before':
        container.parentNode?.insertBefore(button, container);
        break;
      case 'after':
        container.parentNode?.insertBefore(button, container.nextSibling);
        break;
      case 'prepend':
        container.prepend(button);
        break;
      case 'append':
      default:
        container.appendChild(button);
        break;
    }
  }

  private getButtonClassName(config: ButtonPositionConfig, playerInfo: PlayerSizeInfo): string {
    const classes = ['ytgif-player-button', 'ytp-button', 'ytgif-button'];
    
    if (playerInfo.isCompact) classes.push('ytgif-compact-mode');
    if (playerInfo.isTheater) classes.push('ytgif-theater-mode');
    if (playerInfo.isFullscreen) classes.push('ytgif-fullscreen-mode');
    
    // Size-based classes
    if (playerInfo.width < 480) classes.push('ytgif-small-player');
    else if (playerInfo.width < 854) classes.push('ytgif-medium-player');
    else classes.push('ytgif-large-player');

    return classes.join(' ');
  }

  private applyThemeStyles(button: HTMLButtonElement, theme: 'light' | 'dark' | 'auto'): void {
    const resolvedTheme = theme === 'auto' ? this.detectTheme() : theme;
    
    button.classList.remove('ytgif-theme-light', 'ytgif-theme-dark');
    button.classList.add(`ytgif-theme-${resolvedTheme}`);
  }

  private detectTheme(): 'light' | 'dark' {
    // Check YouTube's theme indicators
    const darkModeSelectors = [
      'html[dark]',
      'html[data-theme="dark"]',
      '.ytp-chrome-bottom[data-theme="dark"]',
      '.ytgif-dark-theme'
    ];

    const isDark = darkModeSelectors.some(selector => 
      document.querySelector(selector) !== null
    );

    return isDark ? 'dark' : 'light';
  }

  // Player detection and sizing  
  private detectPlayerInfo(): PlayerSizeInfo | null {
    const player = this.waitForPlayer();
    if (!player) {
      return null;
    }

    const rect = player.getBoundingClientRect();
    
    // Use viewport dimensions if player dimensions are 0
    const width = rect.width || window.innerWidth;
    const height = rect.height || window.innerHeight * 0.6; // Assume 60% height for video
    const aspectRatio = width / height;

    return {
      width,
      height,
      aspectRatio,
      isCompact: this.isCompactMode({ width, height }),
      isTheater: this.isTheaterMode(),
      isFullscreen: this.isFullscreenMode()
    };
  }

  private isCompactMode(size: { width: number; height: number }): boolean {
    return size.width < 480 || size.height < 270;
  }

  private isTheaterMode(): boolean {
    return document.body.classList.contains('ytp-big-mode') ||
           document.querySelector('.ytp-size-button[title*="Theater"]') !== null ||
           document.querySelector('[theater-mode]') !== null;
  }

  private isFullscreenMode(): boolean {
    return document.fullscreenElement !== null ||
           document.body.classList.contains('ytp-fullscreen');
  }

  // Setup methods
  private setupResizeObserver(): void {
    this.resizeObserver = new ResizeObserver(() => {
      this.handlePlayerSizeChange();
    });

    // Start observing when player is found
    setTimeout(() => {
      const player = this.waitForPlayer();
      if (player && this.resizeObserver) {
        this.resizeObserver.observe(player);
      }
    }, 2000);
  }

  private setupNavigationListener(): void {
    youTubeDetector.onNavigation(() => {
      // Re-inject button on navigation
      if (this.clickHandler) {
        setTimeout(() => {
          this.injectionRetryCount = 0;
          this.attemptButtonInjectionWithRetry();
        }, 1000);
      }
    });
  }

  private handlePlayerSizeChange(): void {
    const newPlayerInfo = this.detectPlayerInfo();
    if (!newPlayerInfo) return;

    const sizeChanged = !this.currentPlayerInfo ||
      Math.abs(this.currentPlayerInfo.width - newPlayerInfo.width) > 10 ||
      Math.abs(this.currentPlayerInfo.height - newPlayerInfo.height) > 10 ||
      this.currentPlayerInfo.isCompact !== newPlayerInfo.isCompact ||
      this.currentPlayerInfo.isTheater !== newPlayerInfo.isTheater ||
      this.currentPlayerInfo.isFullscreen !== newPlayerInfo.isFullscreen;

    if (sizeChanged) {
      this.currentPlayerInfo = newPlayerInfo;
      
      // Re-inject button if necessary for better positioning
      if (this.clickHandler && this.shouldReinjectButton(newPlayerInfo)) {
        this.attemptButtonInjection();
      }

      // Notify size change callbacks
      this.sizeChangeCallbacks.forEach(callback => {
        try {
          callback(newPlayerInfo);
        } catch (error) {
          logger.error('[PlayerIntegration] Error in size change callback', { error });
        }
      });
    }
  }

  private shouldReinjectButton(newPlayerInfo: PlayerSizeInfo): boolean {
    // Re-inject if player mode changed significantly
    if (!this.currentPlayerInfo) return true;
    
    return this.currentPlayerInfo.isCompact !== newPlayerInfo.isCompact ||
           this.currentPlayerInfo.isTheater !== newPlayerInfo.isTheater ||
           this.currentPlayerInfo.isFullscreen !== newPlayerInfo.isFullscreen;
  }

  public destroy(): void {
    this.removeButton();
    
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    this.stateChangeCallbacks.clear();
    this.sizeChangeCallbacks.clear();
    this.clickHandler = null;
    this.currentPlayerInfo = null;
  }
}

// Export singleton instance
export const playerIntegration = YouTubePlayerIntegration.getInstance();