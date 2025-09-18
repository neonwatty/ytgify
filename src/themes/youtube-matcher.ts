import { ThemeInfo, themeDetector } from './theme-detector';

interface YouTubeThemeMapping {
  background: string;
  surface: string;
  primaryText: string;
  secondaryText: string;
  accent: string;
  border: string;
  hover: string;
  overlay: string;
  buttonBackground: string;
  buttonHover: string;
  buttonActive: string;
  successColor: string;
  errorColor: string;
  warningColor: string;
}

export class YouTubeMatcher {
  private static instance: YouTubeMatcher;
  private currentMapping: YouTubeThemeMapping;
  private themeUnsubscribe: (() => void) | null = null;

  private constructor() {
    this.currentMapping = this.generateThemeMapping(themeDetector.getCurrentTheme());
    this.themeUnsubscribe = themeDetector.subscribe((themeInfo) => {
      this.currentMapping = this.generateThemeMapping(themeInfo);
      this.applyThemeMapping();
    });
  }

  public static getInstance(): YouTubeMatcher {
    if (!YouTubeMatcher.instance) {
      YouTubeMatcher.instance = new YouTubeMatcher();
    }
    return YouTubeMatcher.instance;
  }

  public getCurrentMapping(): YouTubeThemeMapping {
    return this.currentMapping;
  }

  private generateThemeMapping(themeInfo: ThemeInfo): YouTubeThemeMapping {
    if (themeInfo.isDark) {
      return this.getDarkThemeMapping(themeInfo);
    } else {
      return this.getLightThemeMapping(themeInfo);
    }
  }

  private getDarkThemeMapping(themeInfo: ThemeInfo): YouTubeThemeMapping {
    const customColors = themeInfo.customColors;
    
    return {
      background: customColors?.background || 
                 this.getYouTubeVar('--yt-spec-base-background') || 
                 '#0f0f0f',
      surface: customColors?.surface || 
              this.getYouTubeVar('--yt-spec-raised-background') || 
              '#272727',
      primaryText: customColors?.foreground || 
                  this.getYouTubeVar('--yt-spec-text-primary') || 
                  '#ffffff',
      secondaryText: this.getYouTubeVar('--yt-spec-text-secondary') || 
                    'rgba(255, 255, 255, 0.6)',
      accent: customColors?.primary || 
             this.getYouTubeVar('--yt-spec-call-to-action') || 
             '#ff0000',
      border: customColors?.border || 
             this.getYouTubeVar('--yt-spec-10-percent-layer') || 
             '#3f3f3f',
      hover: this.getYouTubeVar('--yt-spec-badge-chip-background') || 
            'rgba(255, 255, 255, 0.1)',
      overlay: this.getYouTubeVar('--yt-spec-static-overlay-background-solid') || 
              'rgba(0, 0, 0, 0.9)',
      buttonBackground: this.getYouTubeVar('--yt-spec-button-chip-background-hover') || 
                       'rgba(255, 255, 255, 0.1)',
      buttonHover: 'rgba(255, 255, 255, 0.2)',
      buttonActive: 'rgba(255, 255, 255, 0.3)',
      successColor: '#4ade80',
      errorColor: '#ef4444',
      warningColor: '#f59e0b'
    };
  }

  private getLightThemeMapping(themeInfo: ThemeInfo): YouTubeThemeMapping {
    const customColors = themeInfo.customColors;
    
    return {
      background: customColors?.background || 
                 this.getYouTubeVar('--yt-spec-base-background') || 
                 '#ffffff',
      surface: customColors?.surface || 
              this.getYouTubeVar('--yt-spec-raised-background') || 
              '#f9f9f9',
      primaryText: customColors?.foreground || 
                  this.getYouTubeVar('--yt-spec-text-primary') || 
                  '#0f0f0f',
      secondaryText: this.getYouTubeVar('--yt-spec-text-secondary') || 
                    'rgba(15, 15, 15, 0.6)',
      accent: customColors?.primary || 
             this.getYouTubeVar('--yt-spec-call-to-action') || 
             '#ff0000',
      border: customColors?.border || 
             this.getYouTubeVar('--yt-spec-10-percent-layer') || 
             '#e5e5e5',
      hover: this.getYouTubeVar('--yt-spec-badge-chip-background') || 
            'rgba(0, 0, 0, 0.05)',
      overlay: this.getYouTubeVar('--yt-spec-static-overlay-background-solid') || 
              'rgba(0, 0, 0, 0.8)',
      buttonBackground: this.getYouTubeVar('--yt-spec-button-chip-background-hover') || 
                       'rgba(0, 0, 0, 0.05)',
      buttonHover: 'rgba(0, 0, 0, 0.1)',
      buttonActive: 'rgba(0, 0, 0, 0.15)',
      successColor: '#16a34a',
      errorColor: '#dc2626',
      warningColor: '#d97706'
    };
  }

  private getYouTubeVar(varName: string): string | null {
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue(varName)
      .trim();
    return value || null;
  }

  private applyThemeMapping(): void {
    this.setCSSCustomProperties();
    this.updateExtensionClasses();
  }

  private setCSSCustomProperties(): void {
    const root = document.documentElement;
    const mapping = this.currentMapping;
    
    const cssVarMap = {
      '--ytgif-bg': mapping.background,
      '--ytgif-surface': mapping.surface,
      '--ytgif-text-primary': mapping.primaryText,
      '--ytgif-text-secondary': mapping.secondaryText,
      '--ytgif-accent': mapping.accent,
      '--ytgif-border': mapping.border,
      '--ytgif-hover': mapping.hover,
      '--ytgif-overlay': mapping.overlay,
      '--ytgif-btn-bg': mapping.buttonBackground,
      '--ytgif-btn-hover': mapping.buttonHover,
      '--ytgif-btn-active': mapping.buttonActive,
      '--ytgif-success': mapping.successColor,
      '--ytgif-error': mapping.errorColor,
      '--ytgif-warning': mapping.warningColor
    };
    
    Object.entries(cssVarMap).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });
  }

  private updateExtensionClasses(): void {
    const themeInfo = themeDetector.getCurrentTheme();
    const extensionElements = document.querySelectorAll('.ytgif-button, .ytgif-timeline-overlay, .ytgif-quick-presets');
    
    extensionElements.forEach((element) => {
      element.classList.remove('ytgif-theme-light', 'ytgif-theme-dark', 'ytgif-theme-auto');
      element.classList.add(`ytgif-theme-${themeInfo.theme}`);
      
      if (themeInfo.isDark) {
        element.classList.add('ytgif-dark');
        element.classList.remove('ytgif-light');
      } else {
        element.classList.add('ytgif-light');
        element.classList.remove('ytgif-dark');
      }
    });
  }

  public subscribeToThemeChanges(callback: (mapping: YouTubeThemeMapping) => void): () => void {
    return themeDetector.subscribe((themeInfo) => {
      const newMapping = this.generateThemeMapping(themeInfo);
      callback(newMapping);
    });
  }

  public getThemeAwareColor(lightColor: string, darkColor: string): string {
    const themeInfo = themeDetector.getCurrentTheme();
    return themeInfo.isDark ? darkColor : lightColor;
  }

  public getThemeAwareOpacity(baseOpacity: number, isDarkMode?: boolean): number {
    const themeInfo = themeDetector.getCurrentTheme();
    const isDark = isDarkMode ?? themeInfo.isDark;
    
    return isDark ? Math.min(baseOpacity * 1.2, 1) : baseOpacity;
  }

  public generateThemeAwareGradient(colors: {
    light: { start: string; end: string };
    dark: { start: string; end: string };
  }): string {
    const themeInfo = themeDetector.getCurrentTheme();
    const colorSet = themeInfo.isDark ? colors.dark : colors.light;
    
    return `linear-gradient(135deg, ${colorSet.start} 0%, ${colorSet.end} 100%)`;
  }

  public createThemeAwareShadow(options?: {
    lightShadow?: string;
    darkShadow?: string;
    intensity?: number;
  }): string {
    const themeInfo = themeDetector.getCurrentTheme();
    const intensity = options?.intensity ?? 1;
    
    if (themeInfo.isDark) {
      const defaultDark = `0 4px 12px rgba(0, 0, 0, ${0.5 * intensity})`;
      return options?.darkShadow ?? defaultDark;
    } else {
      const defaultLight = `0 2px 8px rgba(0, 0, 0, ${0.1 * intensity})`;
      return options?.lightShadow ?? defaultLight;
    }
  }

  public syncWithYouTubeTransitions(): void {
    const ytAppElement = document.querySelector('ytd-app, #ytd-app');
    if (ytAppElement) {
      const computedStyles = getComputedStyle(ytAppElement);
      const transition = computedStyles.transition || 'all 0.3s ease';
      
      const root = document.documentElement;
      root.style.setProperty('--ytgif-transition', transition);
      
      const extensionElements = document.querySelectorAll('.ytgif-button, .ytgif-timeline-overlay, .ytgif-quick-presets');
      extensionElements.forEach((element) => {
        (element as HTMLElement).style.transition = transition;
      });
    }
  }

  public destroy(): void {
    if (this.themeUnsubscribe) {
      this.themeUnsubscribe();
      this.themeUnsubscribe = null;
    }
    
    const root = document.documentElement;
    const cssVars = [
      '--ytgif-bg', '--ytgif-surface', '--ytgif-text-primary', '--ytgif-text-secondary',
      '--ytgif-accent', '--ytgif-border', '--ytgif-hover', '--ytgif-overlay',
      '--ytgif-btn-bg', '--ytgif-btn-hover', '--ytgif-btn-active',
      '--ytgif-success', '--ytgif-error', '--ytgif-warning', '--ytgif-transition'
    ];
    
    cssVars.forEach(varName => {
      root.style.removeProperty(varName);
    });
  }
}

export const youtubeMatcher = YouTubeMatcher.getInstance();