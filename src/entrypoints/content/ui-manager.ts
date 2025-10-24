// WXT Shadow DOM UI management for React overlays
import { createShadowRootUi } from 'wxt/client';
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import type { ContentScriptContext } from 'wxt/client';

export interface OverlayConfig {
  id: string;
  zIndex?: number;
  backgroundColor?: string;
  position?: 'fixed' | 'absolute';
}

export interface UIManagerInstance {
  mount: (component: React.ReactElement) => void;
  unmount: () => void;
  update: (component: React.ReactElement) => void;
  isVisible: () => boolean;
}

export class ShadowDOMUIManager {
  private overlays: Map<string, UIManagerInstance> = new Map();
  private ctx: ContentScriptContext;

  constructor(ctx: ContentScriptContext) {
    this.ctx = ctx;
  }

  // Create a new shadow DOM overlay for React component
  public createOverlay(config: OverlayConfig): UIManagerInstance {
    const { id, zIndex = 2147483647, backgroundColor = 'rgba(0, 0, 0, 0.85)', position = 'fixed' } = config;

    // Remove existing overlay with same ID
    if (this.overlays.has(id)) {
      this.destroyOverlay(id);
    }

    let reactRoot: Root | null = null;
    let isVisible = false;

    const ui = createShadowRootUi(this.ctx, {
      name: id,
      position: 'overlay',
      onMount: (container) => {
        // Apply overlay styles to container
        container.style.cssText = `
          position: ${position};
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: ${backgroundColor};
          z-index: ${zIndex};
          display: flex;
          align-items: center;
          justify-content: center;
        `;

        // Create div for React root inside shadow DOM
        const reactContainer = document.createElement('div');
        reactContainer.id = `${id}-react-root`;
        reactContainer.style.cssText = `
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        `;

        container.appendChild(reactContainer);
        reactRoot = createRoot(reactContainer);

        console.log(`[ShadowDOMUIManager] Overlay ${id} mounted`);
      },
      onRemove: () => {
        if (reactRoot) {
          reactRoot.unmount();
          reactRoot = null;
        }
        isVisible = false;
        console.log(`[ShadowDOMUIManager] Overlay ${id} removed`);
      },
    });

    const instance: UIManagerInstance = {
      mount: (component: React.ReactElement) => {
        ui.mount();
        if (reactRoot) {
          reactRoot.render(component);
          isVisible = true;
          console.log(`[ShadowDOMUIManager] Component rendered in ${id}`);
        }
      },
      unmount: () => {
        ui.remove();
        isVisible = false;
      },
      update: (component: React.ReactElement) => {
        if (reactRoot && isVisible) {
          reactRoot.render(component);
          console.log(`[ShadowDOMUIManager] Component updated in ${id}`);
        } else {
          console.warn(`[ShadowDOMUIManager] Cannot update ${id} - not mounted`);
        }
      },
      isVisible: () => isVisible,
    };

    this.overlays.set(id, instance);
    return instance;
  }

  // Get existing overlay by ID
  public getOverlay(id: string): UIManagerInstance | undefined {
    return this.overlays.get(id);
  }

  // Destroy overlay and cleanup
  public destroyOverlay(id: string): void {
    const overlay = this.overlays.get(id);
    if (overlay) {
      overlay.unmount();
      this.overlays.delete(id);
      console.log(`[ShadowDOMUIManager] Overlay ${id} destroyed`);
    }
  }

  // Destroy all overlays
  public destroyAll(): void {
    this.overlays.forEach((overlay, id) => {
      overlay.unmount();
    });
    this.overlays.clear();
    console.log('[ShadowDOMUIManager] All overlays destroyed');
  }

  // Check if any overlays are visible
  public hasVisibleOverlays(): boolean {
    return Array.from(this.overlays.values()).some(overlay => overlay.isVisible());
  }
}

// Legacy compatibility wrapper for existing overlay creation pattern
export class LegacyOverlayAdapter {
  private uiManager: ShadowDOMUIManager;
  private currentOverlay: UIManagerInstance | null = null;
  private currentOverlayId: string | null = null;

  constructor(uiManager: ShadowDOMUIManager) {
    this.uiManager = uiManager;
  }

  // Create overlay using old pattern (DOM element + React root)
  // This allows gradual migration from old code
  public createLegacyOverlay(overlayId: string): {
    show: (component: React.ReactElement) => void;
    hide: () => void;
    update: (component: React.ReactElement) => void;
  } {
    this.currentOverlayId = overlayId;

    return {
      show: (component: React.ReactElement) => {
        if (!this.currentOverlay) {
          this.currentOverlay = this.uiManager.createOverlay({ id: overlayId });
        }
        this.currentOverlay.mount(component);
      },
      hide: () => {
        if (this.currentOverlay) {
          this.currentOverlay.unmount();
          this.currentOverlay = null;
        }
      },
      update: (component: React.ReactElement) => {
        if (this.currentOverlay) {
          this.currentOverlay.update(component);
        }
      },
    };
  }

  // Cleanup current overlay
  public cleanup(): void {
    if (this.currentOverlayId) {
      this.uiManager.destroyOverlay(this.currentOverlayId);
      this.currentOverlay = null;
      this.currentOverlayId = null;
    }
  }
}
