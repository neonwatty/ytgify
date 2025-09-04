import { overlayStateManager } from './overlay-state';
import { extensionStateManager } from '@/shared/state-manager';

export interface CleanupTask {
  id: string;
  name: string;
  priority: number; // Higher numbers = higher priority
  cleanup: () => Promise<void> | void;
}

export interface NavigationEvent {
  from: string;
  to: string;
  videoId?: string;
  timestamp: number;
}

export type CleanupListener = (event: NavigationEvent) => void;

export class CleanupManager {
  private cleanupTasks: Map<string, CleanupTask> = new Map();
  private navigationListeners: CleanupListener[] = [];
  private isDestroyed = false;
  private currentCleanupPromise: Promise<void> | null = null;
  private navigationTimeout: NodeJS.Timeout | null = null;
  
  constructor() {
    this.setupDefaultCleanupTasks();
    this.setupNavigationListeners();
  }

  private setupDefaultCleanupTasks(): void {
    // Overlay cleanup task
    this.registerCleanupTask({
      id: 'overlay-cleanup',
      name: 'Overlay State Cleanup',
      priority: 100,
      cleanup: async () => {
        console.log('[CleanupManager] Running overlay cleanup');
        
        // Deactivate overlay if active
        if (overlayStateManager.getMode() !== 'inactive') {
          await overlayStateManager.deactivate();
        }
        
        // Force cleanup of any remaining elements
        const elements = overlayStateManager.getElements();
        if (elements.root) {
          elements.root.unmount();
        }
        if (elements.container && elements.container.parentNode) {
          elements.container.remove();
        }
        
        // Clear overlay state
        overlayStateManager.setElements(null, null);
      }
    });

    // Extension state cleanup task
    this.registerCleanupTask({
      id: 'extension-state-cleanup',
      name: 'Extension State Cleanup',
      priority: 90,
      cleanup: async () => {
        console.log('[CleanupManager] Running extension state cleanup');
        
        // Reset component states
        await extensionStateManager.updateComponentState('timeline', false);
        await extensionStateManager.updateComponentState('editor', false);
        
        // Clear player ready state if navigating away from video
        if (!this.isVideoPage(window.location.href)) {
          await extensionStateManager.updatePlayerReady(false);
        }
      }
    });

    // DOM cleanup task
    this.registerCleanupTask({
      id: 'dom-cleanup',
      name: 'DOM Element Cleanup',
      priority: 80,
      cleanup: () => {
        console.log('[CleanupManager] Running DOM cleanup');
        
        // Remove all extension-created elements
        const extensionElements = document.querySelectorAll('[id^="ytgif-"], [class*="ytgif-"]');
        extensionElements.forEach(element => {
          if (element.parentNode) {
            element.remove();
          }
        });
        
        // Remove any remaining timeline overlays
        const overlayElements = document.querySelectorAll('#ytgif-timeline-overlay, .ytgif-overlay');
        overlayElements.forEach(element => {
          if (element.parentNode) {
            element.remove();
          }
        });
      }
    });

    // Event listener cleanup task
    this.registerCleanupTask({
      id: 'event-cleanup',
      name: 'Event Listener Cleanup',
      priority: 70,
      cleanup: () => {
        console.log('[CleanupManager] Running event listener cleanup');
        
        // Note: Individual managers should handle their own listener cleanup
        // This is a backup to ensure no dangling listeners remain
        
        // Force cleanup of any global event listeners we might have missed
        // This is primarily for safety and shouldn't be necessary if components clean up properly
      }
    });

    // Storage cleanup task (low priority - only clear temporary data)
    this.registerCleanupTask({
      id: 'storage-cleanup',
      name: 'Temporary Storage Cleanup',
      priority: 10,
      cleanup: async () => {
        console.log('[CleanupManager] Running storage cleanup');
        
        try {
          // Clear any temporary data from session storage
          if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session) {
            // Only clear temporary/session data, preserve user preferences and GIF library
            const sessionData = await chrome.storage.session.get(null);
            const keysToRemove = Object.keys(sessionData).filter(key => 
              key.includes('temp') || key.includes('session') || key.includes('cache')
            );
            
            if (keysToRemove.length > 0) {
              await chrome.storage.session.remove(keysToRemove);
            }
          }
        } catch (error) {
          console.warn('[CleanupManager] Storage cleanup error:', error);
        }
      }
    });
  }

  private setupNavigationListeners(): void {
    // Listen to URL changes (YouTube SPA navigation)
    let currentUrl = window.location.href;
    const urlObserver = new MutationObserver(() => {
      if (window.location.href !== currentUrl) {
        const from = currentUrl;
        const to = window.location.href;
        currentUrl = to;
        
        this.handleNavigation({
          from: this.getPageTypeFromUrl(from),
          to: this.getPageTypeFromUrl(to),
          videoId: this.extractVideoIdFromUrl(to),
          timestamp: Date.now()
        });
      }
    });

    // Observe URL changes by watching the document
    urlObserver.observe(document, { subtree: true, childList: true });

    // Also listen to popstate events for back/forward navigation
    const popstateHandler = () => {
      // Small delay to ensure URL has updated
      setTimeout(() => {
        this.handleNavigation({
          from: 'unknown',
          to: this.getPageTypeFromUrl(window.location.href),
          videoId: this.extractVideoIdFromUrl(window.location.href),
          timestamp: Date.now()
        });
      }, 50);
    };
    
    window.addEventListener('popstate', popstateHandler);

    // Store cleanup for navigation listeners
    this.registerCleanupTask({
      id: 'navigation-listeners-cleanup',
      name: 'Navigation Listeners Cleanup',
      priority: 60,
      cleanup: () => {
        console.log('[CleanupManager] Cleaning up navigation listeners');
        urlObserver.disconnect();
        window.removeEventListener('popstate', popstateHandler);
      }
    });
  }

  private handleNavigation(event: NavigationEvent): void {
    console.log('[CleanupManager] Navigation detected:', event);
    
    // Clear any existing timeout
    if (this.navigationTimeout) {
      clearTimeout(this.navigationTimeout);
    }
    
    // Debounce navigation events (YouTube can fire multiple rapid navigation events)
    this.navigationTimeout = setTimeout(() => {
      this.processNavigation(event);
    }, 100);
  }

  private async processNavigation(event: NavigationEvent): Promise<void> {
    // Notify listeners first
    this.navigationListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[CleanupManager] Error in navigation listener:', error);
      }
    });
    
    // Update overlay state with navigation info
    overlayStateManager.handleNavigation(event.to, event.videoId);
    
    // Determine if cleanup is needed
    const needsCleanup = this.shouldCleanup(event.from, event.to);
    
    if (needsCleanup) {
      console.log('[CleanupManager] Navigation requires cleanup');
      await this.runCleanup();
    } else {
      console.log('[CleanupManager] Navigation does not require cleanup');
    }
  }

  private shouldCleanup(fromPageType: string, toPageType: string): boolean {
    // Always cleanup when navigating away from video pages
    if ((fromPageType === 'watch' || fromPageType === 'shorts') && 
        (toPageType !== 'watch' && toPageType !== 'shorts')) {
      return true;
    }
    
    // Cleanup when switching between different video types
    if (fromPageType === 'watch' && toPageType === 'shorts') {
      return true;
    }
    
    if (fromPageType === 'shorts' && toPageType === 'watch') {
      return true;
    }
    
    // Cleanup when navigating to non-YouTube pages
    if (toPageType === 'unknown' || toPageType === 'other') {
      return true;
    }
    
    return false;
  }

  private getPageTypeFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      
      if (!urlObj.hostname.includes('youtube.com')) {
        return 'other';
      }
      
      if (urlObj.pathname.includes('/watch')) {
        return 'watch';
      }
      
      if (urlObj.pathname.includes('/shorts')) {
        return 'shorts';
      }
      
      if (urlObj.pathname === '/' || urlObj.pathname.includes('/feed')) {
        return 'home';
      }
      
      if (urlObj.pathname.includes('/channel') || urlObj.pathname.includes('/c/') || urlObj.pathname.includes('/@')) {
        return 'channel';
      }
      
      if (urlObj.pathname.includes('/playlist')) {
        return 'playlist';
      }
      
      return 'youtube';
    } catch (error) {
      console.warn('[CleanupManager] Error parsing URL:', url, error);
      return 'unknown';
    }
  }

  private extractVideoIdFromUrl(url: string): string | undefined {
    try {
      const urlObj = new URL(url);
      
      // Standard watch URLs
      if (urlObj.pathname === '/watch') {
        return urlObj.searchParams.get('v') || undefined;
      }
      
      // Shorts URLs
      if (urlObj.pathname.includes('/shorts/')) {
        const shortId = urlObj.pathname.split('/shorts/')[1];
        return shortId?.split('/')[0] || undefined;
      }
      
      return undefined;
    } catch (error) {
      console.warn('[CleanupManager] Error extracting video ID from URL:', url, error);
      return undefined;
    }
  }

  private isVideoPage(url: string): boolean {
    const pageType = this.getPageTypeFromUrl(url);
    return pageType === 'watch' || pageType === 'shorts';
  }

  // Public API for registering cleanup tasks
  registerCleanupTask(task: CleanupTask): void {
    if (this.isDestroyed) {
      console.warn('[CleanupManager] Cannot register task on destroyed manager');
      return;
    }
    
    this.cleanupTasks.set(task.id, task);
    console.log(`[CleanupManager] Registered cleanup task: ${task.name}`);
  }

  unregisterCleanupTask(taskId: string): boolean {
    const removed = this.cleanupTasks.delete(taskId);
    if (removed) {
      console.log(`[CleanupManager] Unregistered cleanup task: ${taskId}`);
    }
    return removed;
  }

  // Public API for adding navigation listeners
  addNavigationListener(listener: CleanupListener): void {
    if (this.isDestroyed) {
      console.warn('[CleanupManager] Cannot add listener to destroyed manager');
      return;
    }
    
    this.navigationListeners.push(listener);
  }

  removeNavigationListener(listener: CleanupListener): void {
    const index = this.navigationListeners.indexOf(listener);
    if (index > -1) {
      this.navigationListeners.splice(index, 1);
    }
  }

  // Manual cleanup trigger
  async runCleanup(): Promise<void> {
    if (this.currentCleanupPromise) {
      console.log('[CleanupManager] Cleanup already in progress, waiting...');
      await this.currentCleanupPromise;
      return;
    }
    
    this.currentCleanupPromise = this.executeCleanup();
    await this.currentCleanupPromise;
    this.currentCleanupPromise = null;
  }

  private async executeCleanup(): Promise<void> {
    if (this.isDestroyed) {
      console.log('[CleanupManager] Skipping cleanup - manager is destroyed');
      return;
    }
    
    console.log('[CleanupManager] Starting cleanup process...');
    
    // Get tasks sorted by priority (highest first)
    const tasks = Array.from(this.cleanupTasks.values())
      .sort((a, b) => b.priority - a.priority);
    
    const results: { task: string; success: boolean; error?: Error }[] = [];
    
    for (const task of tasks) {
      try {
        console.log(`[CleanupManager] Running cleanup task: ${task.name}`);
        await task.cleanup();
        results.push({ task: task.name, success: true });
      } catch (error) {
        console.error(`[CleanupManager] Cleanup task failed: ${task.name}`, error);
        results.push({ task: task.name, success: false, error: error as Error });
      }
    }
    
    // Log summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    if (failed > 0) {
      console.warn(`[CleanupManager] Cleanup completed with errors: ${successful} successful, ${failed} failed`);
      results.filter(r => !r.success).forEach(r => {
        console.error(`[CleanupManager] Failed task: ${r.task}`, r.error);
      });
    } else {
      console.log(`[CleanupManager] Cleanup completed successfully: ${successful} tasks`);
    }
  }

  // Emergency cleanup - forces cleanup of everything
  async emergencyCleanup(): Promise<void> {
    console.warn('[CleanupManager] Running emergency cleanup!');
    
    try {
      // Force stop any running cleanup
      this.currentCleanupPromise = null;
      
      // Clear timeouts
      if (this.navigationTimeout) {
        clearTimeout(this.navigationTimeout);
        this.navigationTimeout = null;
      }
      
      // Run all cleanup tasks
      await this.runCleanup();
      
    } catch (error) {
      console.error('[CleanupManager] Emergency cleanup failed:', error);
    }
  }

  // Destroy the cleanup manager
  async destroy(): Promise<void> {
    if (this.isDestroyed) {
      return;
    }
    
    console.log('[CleanupManager] Destroying cleanup manager...');
    this.isDestroyed = true;
    
    // Clear navigation timeout
    if (this.navigationTimeout) {
      clearTimeout(this.navigationTimeout);
      this.navigationTimeout = null;
    }
    
    // Wait for any running cleanup to complete
    if (this.currentCleanupPromise) {
      try {
        await this.currentCleanupPromise;
      } catch (error) {
        console.error('[CleanupManager] Error waiting for cleanup completion:', error);
      }
    }
    
    // Run final cleanup
    await this.runCleanup();
    
    // Clear all registered tasks and listeners
    this.cleanupTasks.clear();
    this.navigationListeners = [];
    
    console.log('[CleanupManager] Cleanup manager destroyed');
  }

  // Debug helper
  debug(): void {
    console.group('Cleanup Manager Debug');
    console.log('Is Destroyed:', this.isDestroyed);
    console.log('Registered Tasks:', Array.from(this.cleanupTasks.values()).map(t => ({ id: t.id, name: t.name, priority: t.priority })));
    console.log('Navigation Listeners:', this.navigationListeners.length);
    console.log('Current Cleanup Promise:', this.currentCleanupPromise ? 'Running' : 'None');
    console.log('Navigation Timeout:', this.navigationTimeout ? 'Set' : 'None');
    console.log('Current URL:', window.location.href);
    console.log('Current Page Type:', this.getPageTypeFromUrl(window.location.href));
    console.groupEnd();
  }
}

// Singleton instance
export const cleanupManager = new CleanupManager();