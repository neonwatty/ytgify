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

export interface ButtonPositionConfig {
  selector: string;
  position: 'before' | 'after' | 'prepend' | 'append';
  priority: number;
  requiredMinWidth?: number;
  requiredMinHeight?: number;
  theme?: 'light' | 'dark' | 'auto';
}

export type ButtonStateChangeCallback = (isActive: boolean, playerInfo: PlayerSizeInfo) => void;
export type PlayerSizeChangeCallback = (sizeInfo: PlayerSizeInfo) => void;

export class YouTubePlayerIntegration {
  private static instance: YouTubePlayerIntegration;
  private button: HTMLButtonElement | null = null;
  private isActive = false;
  private currentPlayerInfo: PlayerSizeInfo | null = null;
  private stateChangeCallbacks: Set<ButtonStateChangeCallback> = new Set();
  private sizeChangeCallbacks: Set<PlayerSizeChangeCallback> = new Set();
  private resizeObserver: ResizeObserver | null = null;
  private clickHandler: ((event: Event) => void) | null = null;

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
    return this.attemptButtonInjection();
  }

  public removeButton(): void {
    if (this.button && this.button.parentNode) {
      this.button.parentNode.removeChild(this.button);
    }
    this.button = null;
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

  public getButtonState(): boolean {
    return this.isActive;
  }

  public getCurrentPlayerInfo(): PlayerSizeInfo | null {
    return this.currentPlayerInfo ? { ...this.currentPlayerInfo } : null;
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
    const classes = ['ytgif-player-button'];
    
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
    const player = youTubeDetector.getPlayerContainer();
    if (!player) {
      return null;
    }

    const rect = player.getBoundingClientRect();
    const aspectRatio = rect.width / rect.height;

    return {
      width: rect.width,
      height: rect.height,
      aspectRatio,
      isCompact: this.isCompactMode(rect),
      isTheater: this.isTheaterMode(),
      isFullscreen: this.isFullscreenMode()
    };
  }

  private isCompactMode(rect: DOMRect): boolean {
    return rect.width < 480 || rect.height < 270;
  }

  private isTheaterMode(): boolean {
    const theaterSelectors = [
      'body[theater]',
      '.ytp-big-mode',
      '[data-theater="true"]',
      '.theater-mode'
    ];
    return theaterSelectors.some(selector => document.querySelector(selector) !== null);
  }

  private isFullscreenMode(): boolean {
    const doc = document as Document & {
      webkitFullscreenElement?: Element;
      mozFullScreenElement?: Element;  
      msFullscreenElement?: Element;
    };
    
    return document.fullscreenElement !== null ||
           doc.webkitFullscreenElement !== undefined ||
           doc.mozFullScreenElement !== undefined ||
           doc.msFullscreenElement !== undefined;
  }

  // Event handling setup
  private setupResizeObserver(): void {
    if (!('ResizeObserver' in window)) {
      logger.warn('[PlayerIntegration] ResizeObserver not supported');
      return;
    }

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === youTubeDetector.getPlayerContainer()) {
          this.handlePlayerSizeChange();
          break;
        }
      }
    });

    // Start observing when player is found
    setTimeout(() => {
      const player = youTubeDetector.getPlayerContainer();
      if (player && this.resizeObserver) {
        this.resizeObserver.observe(player);
      }
    }, 1000);
  }

  private setupNavigationListener(): void {
    youTubeDetector.onNavigation(() => {
      // Re-inject button on navigation
      if (this.clickHandler) {
        setTimeout(() => {
          this.attemptButtonInjection();
        }, 500);
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

      logger.debug('[PlayerIntegration] Player size changed', { playerInfo: newPlayerInfo });
    }
  }

  private shouldReinjectButton(newPlayerInfo: PlayerSizeInfo): boolean {
    if (!this.button || !this.button.parentNode) {
      return true;
    }

    // Check if current position is still optimal
    for (const config of this.positionConfigs) {
      if (config.requiredMinWidth && newPlayerInfo.width < config.requiredMinWidth) {
        continue;
      }
      if (config.requiredMinHeight && newPlayerInfo.height < config.requiredMinHeight) {
        continue;
      }

      const container = document.querySelector(config.selector) as HTMLElement;
      if (container && container.contains(this.button)) {
        // Current position is still good
        return false;
      }
      
      // Found a better position
      if (container) {
        return true;
      }
    }

    return false;
  }

  // Cleanup
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

    logger.info('[PlayerIntegration] Destroyed');
  }
}

// Export singleton instance
export const playerIntegration = YouTubePlayerIntegration.getInstance();