export interface ThemeInfo {
  theme: 'light' | 'dark' | 'auto';
  isDark: boolean;
  systemPrefersDark: boolean;
  customColors?: {
    primary: string;
    background: string;
    foreground: string;
    surface: string;
    border: string;
  };
}

type ThemeChangeCallback = (themeInfo: ThemeInfo) => void;

export class ThemeDetector {
  private static instance: ThemeDetector;
  private callbacks: Set<ThemeChangeCallback> = new Set();
  private mediaQuery: MediaQueryList;
  private currentTheme: ThemeInfo;

  private constructor() {
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.currentTheme = this.detectCurrentTheme();
    
    this.mediaQuery.addEventListener('change', this.handleSystemThemeChange.bind(this));
    
    this.setupMutationObserver();
  }

  public static getInstance(): ThemeDetector {
    if (!ThemeDetector.instance) {
      ThemeDetector.instance = new ThemeDetector();
    }
    return ThemeDetector.instance;
  }

  public getCurrentTheme(): ThemeInfo {
    return this.currentTheme;
  }

  public subscribe(callback: ThemeChangeCallback): () => void {
    this.callbacks.add(callback);
    
    callback(this.currentTheme);
    
    return () => {
      this.callbacks.delete(callback);
    };
  }

  private detectCurrentTheme(): ThemeInfo {
    const systemPrefersDark = this.mediaQuery.matches;
    
    const htmlElement = document.documentElement;
    
    let isDark = systemPrefersDark;
    let theme: 'light' | 'dark' | 'auto' = 'auto';
    
    if (htmlElement.hasAttribute('dark') || htmlElement.classList.contains('dark')) {
      isDark = true;
      theme = 'dark';
    } else if (htmlElement.hasAttribute('light') || htmlElement.classList.contains('light')) {
      isDark = false;
      theme = 'light';
    }
    
    const customColors = this.extractCustomColors();
    
    return {
      theme,
      isDark,
      systemPrefersDark,
      customColors
    };
  }

  private extractCustomColors(): ThemeInfo['customColors'] | undefined {
    const computedStyles = getComputedStyle(document.documentElement);
    
    const getCSSVar = (varName: string): string | undefined => {
      const value = computedStyles.getPropertyValue(varName).trim();
      return value || undefined;
    };
    
    const primary = getCSSVar('--primary-color') || 
                   getCSSVar('--yt-spec-text-primary') ||
                   getCSSVar('--primary');
    
    const background = getCSSVar('--background-color') || 
                      getCSSVar('--yt-spec-base-background') ||
                      getCSSVar('--background');
    
    const foreground = getCSSVar('--foreground-color') || 
                      getCSSVar('--yt-spec-text-primary') ||
                      getCSSVar('--foreground');
    
    const surface = getCSSVar('--surface-color') || 
                   getCSSVar('--yt-spec-raised-background') ||
                   getCSSVar('--card');
    
    const border = getCSSVar('--border-color') || 
                  getCSSVar('--yt-spec-10-percent-layer') ||
                  getCSSVar('--border');
    
    if (primary || background || foreground || surface || border) {
      return {
        primary: primary || '#ff0000',
        background: background || (this.currentTheme?.isDark ? '#0f0f0f' : '#ffffff'),
        foreground: foreground || (this.currentTheme?.isDark ? '#ffffff' : '#0f0f0f'),
        surface: surface || (this.currentTheme?.isDark ? '#272727' : '#f9f9f9'),
        border: border || (this.currentTheme?.isDark ? '#3f3f3f' : '#e5e5e5')
      };
    }
    
    return undefined;
  }

  private setupMutationObserver(): void {
    const observer = new MutationObserver((mutations) => {
      let shouldUpdate = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes') {
          const target = mutation.target as Element;
          if (target === document.documentElement || target === document.body) {
            const attributeName = mutation.attributeName;
            if (attributeName === 'class' || 
                attributeName === 'dark' || 
                attributeName === 'light' ||
                attributeName === 'data-theme') {
              shouldUpdate = true;
            }
          }
        }
        
        if (mutation.type === 'childList' && mutation.target === document.head) {
          const addedNodes = Array.from(mutation.addedNodes);
          if (addedNodes.some(node => 
            node.nodeType === Node.ELEMENT_NODE && 
            (node as Element).tagName === 'STYLE'
          )) {
            shouldUpdate = true;
          }
        }
      });
      
      if (shouldUpdate) {
        setTimeout(() => this.updateTheme(), 100);
      }
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'dark', 'light', 'data-theme']
    });
    
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'dark', 'light', 'data-theme']
    });
    
    observer.observe(document.head, {
      childList: true,
      subtree: true
    });
  }

  private handleSystemThemeChange(_event: MediaQueryListEvent): void {
    if (this.currentTheme.theme === 'auto') {
      this.updateTheme();
    }
  }

  private updateTheme(): void {
    const newTheme = this.detectCurrentTheme();
    
    if (this.hasThemeChanged(this.currentTheme, newTheme)) {
      this.currentTheme = newTheme;
      this.notifyCallbacks(newTheme);
    }
  }

  private hasThemeChanged(oldTheme: ThemeInfo, newTheme: ThemeInfo): boolean {
    return oldTheme.theme !== newTheme.theme ||
           oldTheme.isDark !== newTheme.isDark ||
           oldTheme.systemPrefersDark !== newTheme.systemPrefersDark ||
           this.customColorsChanged(oldTheme.customColors, newTheme.customColors);
  }

  private customColorsChanged(
    oldColors: ThemeInfo['customColors'], 
    newColors: ThemeInfo['customColors']
  ): boolean {
    if (!oldColors && !newColors) return false;
    if (!oldColors || !newColors) return true;
    
    const keys: (keyof NonNullable<ThemeInfo['customColors']>)[] = 
      ['primary', 'background', 'foreground', 'surface', 'border'];
    
    return keys.some(key => oldColors[key] !== newColors[key]);
  }

  private notifyCallbacks(themeInfo: ThemeInfo): void {
    this.callbacks.forEach(callback => {
      try {
        callback(themeInfo);
      } catch (error) {
        console.error('Error in theme change callback:', error);
      }
    });
  }

  public destroy(): void {
    this.mediaQuery.removeEventListener('change', this.handleSystemThemeChange.bind(this));
    this.callbacks.clear();
  }
}

export const themeDetector = ThemeDetector.getInstance();