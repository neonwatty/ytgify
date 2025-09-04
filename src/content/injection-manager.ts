// Content script injection management for YouTube SPA navigation
import { logger } from '@/lib/logger';
import { youTubeDetector, YouTubeNavigationEvent, YouTubePageState } from './youtube-detector';

export interface InjectionTarget {
  selector: string;
  requiredPageTypes: string[];
  priority: number;
  persistent: boolean;
}

export interface InjectedElement {
  element: HTMLElement;
  target: InjectionTarget;
  injectedAt: Date;
  pageState: YouTubePageState;
}

export type InjectionCallback = (
  target: InjectionTarget, 
  container: HTMLElement,
  pageState: YouTubePageState
) => HTMLElement | null;

export type CleanupCallback = (element: HTMLElement, pageState: YouTubePageState) => void;

export class InjectionManager {
  private static instance: InjectionManager;
  private injectionTargets: Map<string, InjectionTarget> = new Map();
  private injectionCallbacks: Map<string, InjectionCallback> = new Map();
  private cleanupCallbacks: Map<string, CleanupCallback> = new Map();
  private injectedElements: Map<string, InjectedElement> = new Map();
  private retryAttempts: Map<string, number> = new Map();
  private maxRetries = 5;
  private retryDelay = 1000;

  private constructor() {
    this.setupNavigationListener();
    this.scheduleInitialInjection();
  }

  public static getInstance(): InjectionManager {
    if (!InjectionManager.instance) {
      InjectionManager.instance = new InjectionManager();
    }
    return InjectionManager.instance;
  }

  // Register an injection target with callback
  public registerInjection(
    id: string,
    target: InjectionTarget,
    callback: InjectionCallback,
    cleanupCallback?: CleanupCallback
  ): void {
    this.injectionTargets.set(id, target);
    this.injectionCallbacks.set(id, callback);
    
    if (cleanupCallback) {
      this.cleanupCallbacks.set(id, cleanupCallback);
    }

    logger.debug('[InjectionManager] Registered injection target', { id, target });

    // Attempt immediate injection if appropriate
    this.attemptInjection(id);
  }

  // Unregister an injection target
  public unregisterInjection(id: string): void {
    // Clean up existing injection
    this.cleanupInjection(id);
    
    // Remove from registries
    this.injectionTargets.delete(id);
    this.injectionCallbacks.delete(id);
    this.cleanupCallbacks.delete(id);
    this.retryAttempts.delete(id);

    logger.debug('[InjectionManager] Unregistered injection target', { id });
  }

  // Get injected element by ID
  public getInjectedElement(id: string): HTMLElement | null {
    const injected = this.injectedElements.get(id);
    return injected?.element || null;
  }

  // Check if element is currently injected
  public isInjected(id: string): boolean {
    const injected = this.injectedElements.get(id);
    return injected !== undefined && document.contains(injected.element);
  }

  // Force re-injection of all targets
  public reinjectAll(): void {
    logger.info('[InjectionManager] Reinjecting all targets');
    
    for (const id of this.injectionTargets.keys()) {
      this.attemptInjection(id);
    }
  }

  // Clean up specific injection
  private cleanupInjection(id: string): void {
    const injected = this.injectedElements.get(id);
    if (!injected) return;

    try {
      // Call custom cleanup callback if provided
      const cleanupCallback = this.cleanupCallbacks.get(id);
      if (cleanupCallback) {
        cleanupCallback(injected.element, injected.pageState);
      }

      // Remove element from DOM
      if (document.contains(injected.element)) {
        injected.element.remove();
      }

      this.injectedElements.delete(id);
      
      logger.debug('[InjectionManager] Cleaned up injection', { id });
    } catch (error) {
      logger.error('[InjectionManager] Error during cleanup', { id, error });
    }
  }

  // Attempt injection for a specific target
  private attemptInjection(id: string): void {
    const target = this.injectionTargets.get(id);
    const callback = this.injectionCallbacks.get(id);
    
    if (!target || !callback) {
      logger.warn('[InjectionManager] Missing target or callback for injection', { id });
      return;
    }

    const currentState = youTubeDetector.getCurrentState();
    
    // Check if injection is appropriate for current page type
    if (!this.shouldInject(target, currentState)) {
      logger.debug('[InjectionManager] Skipping injection for current page type', { 
        id, 
        pageType: currentState.pageType,
        requiredTypes: target.requiredPageTypes 
      });
      return;
    }

    // Check if already injected and persistent
    if (this.isInjected(id)) {
      const existingInjection = this.injectedElements.get(id);
      if (target.persistent && existingInjection) {
        logger.debug('[InjectionManager] Persistent injection already exists', { id });
        return;
      } else {
        // Clean up existing injection for re-injection
        this.cleanupInjection(id);
      }
    }

    // Find target container
    const container = document.querySelector(target.selector) as HTMLElement;
    if (!container) {
      this.scheduleRetryInjection(id);
      return;
    }

    try {
      // Execute injection callback
      const element = callback(target, container, currentState);
      
      if (element) {
        // Track successful injection
        this.injectedElements.set(id, {
          element,
          target,
          injectedAt: new Date(),
          pageState: { ...currentState }
        });

        // Reset retry counter
        this.retryAttempts.delete(id);
        
        logger.info('[InjectionManager] Successfully injected element', { 
          id, 
          selector: target.selector,
          pageType: currentState.pageType 
        });
      } else {
        logger.warn('[InjectionManager] Injection callback returned null', { id });
        this.scheduleRetryInjection(id);
      }
    } catch (error) {
      logger.error('[InjectionManager] Error during injection', { id, error });
      this.scheduleRetryInjection(id);
    }
  }

  // Check if injection should occur for current state
  private shouldInject(target: InjectionTarget, state: YouTubePageState): boolean {
    // If no specific page types required, inject everywhere
    if (target.requiredPageTypes.length === 0) {
      return true;
    }

    // Check if current page type is in required types
    return target.requiredPageTypes.includes(state.pageType);
  }

  // Schedule retry injection with backoff
  private scheduleRetryInjection(id: string): void {
    const attempts = this.retryAttempts.get(id) || 0;
    
    if (attempts >= this.maxRetries) {
      logger.warn('[InjectionManager] Max retry attempts reached', { id, attempts });
      return;
    }

    this.retryAttempts.set(id, attempts + 1);
    
    const delay = this.retryDelay * Math.pow(2, attempts); // Exponential backoff
    
    logger.debug('[InjectionManager] Scheduling retry injection', { 
      id, 
      attempt: attempts + 1, 
      delay 
    });

    setTimeout(() => {
      this.attemptInjection(id);
    }, delay);
  }

  // Setup navigation event listener
  private setupNavigationListener(): void {
    youTubeDetector.onNavigation((event: YouTubeNavigationEvent) => {
      logger.debug('[InjectionManager] Handling navigation event', {
        from: event.fromState.pageType,
        to: event.toState.pageType,
        type: event.navigationType
      });

      // Clean up non-persistent injections from previous page
      this.handleNavigationCleanup(event.fromState, event.toState);
      
      // Attempt new injections for current page
      this.handleNavigationInjections(event.toState);
    });
  }

  // Handle cleanup during navigation
  private handleNavigationCleanup(fromState: YouTubePageState, toState: YouTubePageState): void {
    for (const [id] of this.injectedElements.entries()) {
      const target = this.injectionTargets.get(id);
      if (!target) continue;

      // Keep persistent injections unless page type changed significantly
      if (target.persistent && fromState.pageType === toState.pageType) {
        continue;
      }

      // Clean up injections that are no longer appropriate
      if (!this.shouldInject(target, toState)) {
        logger.debug('[InjectionManager] Cleaning up injection due to navigation', { 
          id, 
          fromPage: fromState.pageType, 
          toPage: toState.pageType 
        });
        this.cleanupInjection(id);
      }
    }
  }

  // Handle injections for new page state
  private handleNavigationInjections(_newState: YouTubePageState): void {
    // Schedule injections after a brief delay to allow DOM to settle
    setTimeout(() => {
      for (const id of this.injectionTargets.keys()) {
        this.attemptInjection(id);
      }
    }, 100);
  }

  // Schedule initial injection after DOM ready
  private scheduleInitialInjection(): void {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.performInitialInjection();
      });
    } else {
      // DOM already ready
      this.performInitialInjection();
    }
  }

  // Perform initial injection for all registered targets
  private performInitialInjection(): void {
    logger.info('[InjectionManager] Performing initial injection');
    
    // Small delay to ensure YouTube's initial setup is complete
    setTimeout(() => {
      this.reinjectAll();
    }, 500);
  }

  // Wait for specific selector to be available
  public async waitForSelector(selector: string, timeout = 10000): Promise<HTMLElement | null> {
    return new Promise((resolve) => {
      const element = document.querySelector(selector) as HTMLElement;
      if (element) {
        resolve(element);
        return;
      }

      const timeoutId = setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);

      const observer = new MutationObserver(() => {
        const foundElement = document.querySelector(selector) as HTMLElement;
        if (foundElement) {
          clearTimeout(timeoutId);
          observer.disconnect();
          resolve(foundElement);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    });
  }

  // Create injection helper for common patterns
  public createButtonInjection(
    id: string,
    buttonConfig: {
      selector: string;
      pageTypes?: string[];
      buttonClass?: string;
      position?: 'before' | 'after' | 'append' | 'prepend';
      content: string;
      onClick: (event: Event) => void;
    }
  ): void {
    const target: InjectionTarget = {
      selector: buttonConfig.selector,
      requiredPageTypes: buttonConfig.pageTypes || [],
      priority: 1,
      persistent: true
    };

    const callback: InjectionCallback = (target, container) => {
      // Check if button already exists
      const existingButton = document.getElementById(id);
      if (existingButton) {
        return existingButton;
      }

      const button = document.createElement('button');
      button.id = id;
      button.className = buttonConfig.buttonClass || '';
      button.innerHTML = buttonConfig.content;
      button.addEventListener('click', buttonConfig.onClick);

      // Insert button based on position preference
      switch (buttonConfig.position) {
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

      return button;
    };

    const cleanup: CleanupCallback = (element) => {
      element.removeEventListener('click', buttonConfig.onClick);
    };

    this.registerInjection(id, target, callback, cleanup);
  }

  // Destroy injection manager
  public destroy(): void {
    // Clean up all injections
    for (const id of this.injectionTargets.keys()) {
      this.cleanupInjection(id);
    }

    // Clear all registries
    this.injectionTargets.clear();
    this.injectionCallbacks.clear();
    this.cleanupCallbacks.clear();
    this.injectedElements.clear();
    this.retryAttempts.clear();

    logger.info('[InjectionManager] Destroyed');
  }
}

// Export singleton instance
export const injectionManager = InjectionManager.getInstance();