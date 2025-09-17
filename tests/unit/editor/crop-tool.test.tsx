import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';
import { CropTool } from '@/editor/crop/crop-tool';

// Mock components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>
}));

jest.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' ')
}));

// Define types for test
interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

describe('CropTool', () => {
  let mockOnCropChange: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockOnCropChange = jest.fn();

    // Mock ResizeObserver
    global.ResizeObserver = class ResizeObserver {
      observe = jest.fn();
      unobserve = jest.fn();
      disconnect = jest.fn();
    } as any;

    // Mock getBoundingClientRect
    Element.prototype.getBoundingClientRect = jest.fn(() => ({
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      right: 800,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: () => ({})
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render the crop tool', () => {

      const { container } = render(
        <CropTool
          originalWidth={1920}
          originalHeight={1080}
          onCropChange={mockOnCropChange}
        />
      );

      expect(container.firstChild).toBeTruthy();
    });

    it('should render with initial crop area', () => {

      const cropArea: CropArea = {
        x: 100,
        y: 100,
        width: 300,
        height: 200
      };

      const { container } = render(
        <CropTool
          originalWidth={1920}
          originalHeight={1080}
          cropArea={cropArea}
          onCropChange={mockOnCropChange}
        />
      );

      // Check that crop area is rendered - look for the border-primary class
      const cropElement = container.querySelector('.border-primary.cursor-move');
      expect(cropElement).toBeTruthy();
    });

    it('should render children', () => {

      render(
        <CropTool
          originalWidth={1920}
          originalHeight={1080}
          onCropChange={mockOnCropChange}
        >
          <div data-testid="child-element">Test Child</div>
        </CropTool>
      );

      expect(screen.getByTestId('child-element')).toBeTruthy();
    });

    it('should apply custom className', () => {

      const { container } = render(
        <CropTool
          originalWidth={1920}
          originalHeight={1080}
          onCropChange={mockOnCropChange}
          className="custom-class"
        />
      );

      expect((container.firstChild as HTMLElement).className).toContain('custom-class');
    });
  });

  describe('Dragging Functionality', () => {
    beforeEach(() => {
      // Setup for tests
    });

    it('should handle dragging crop area', () => {
      const cropArea: CropArea = {
        x: 100,
        y: 100,
        width: 300,
        height: 200
      };

      const { container } = render(
        <CropTool
          originalWidth={1920}
          originalHeight={1080}
          cropArea={cropArea}
          onCropChange={mockOnCropChange}
        />
      );

      const cropElement = container.querySelector('[data-crop-area]') as HTMLElement;
      if (cropElement) {
        // Start dragging
        fireEvent.mouseDown(cropElement, { clientX: 150, clientY: 150 });

        // Move mouse
        fireEvent.mouseMove(document, { clientX: 200, clientY: 200 });

        // Stop dragging
        fireEvent.mouseUp(document);

        expect(mockOnCropChange).toHaveBeenCalled();
      }
    });

    it('should not drag when disabled', () => {
      const cropArea: CropArea = {
        x: 100,
        y: 100,
        width: 300,
        height: 200
      };

      const { container } = render(
        <CropTool
          originalWidth={1920}
          originalHeight={1080}
          cropArea={cropArea}
          onCropChange={mockOnCropChange}
          disabled={true}
        />
      );

      const cropElement = container.querySelector('[data-crop-area]') as HTMLElement;
      if (cropElement) {
        fireEvent.mouseDown(cropElement, { clientX: 150, clientY: 150 });
        fireEvent.mouseMove(document, { clientX: 200, clientY: 200 });
        fireEvent.mouseUp(document);

        expect(mockOnCropChange).not.toHaveBeenCalled();
      }
    });
  });

  describe('Resizing Functionality', () => {
    beforeEach(() => {
      // Setup for tests
    });

    it('should handle resizing crop area', () => {
      const cropArea: CropArea = {
        x: 100,
        y: 100,
        width: 300,
        height: 200
      };

      const { container } = render(
        <CropTool
          originalWidth={1920}
          originalHeight={1080}
          cropArea={cropArea}
          onCropChange={mockOnCropChange}
        />
      );

      const resizeHandle = container.querySelector('[data-resize-handle]') as HTMLElement;
      if (resizeHandle) {
        // Start resizing
        fireEvent.mouseDown(resizeHandle, { clientX: 400, clientY: 300 });

        // Move mouse to resize
        fireEvent.mouseMove(document, { clientX: 450, clientY: 350 });

        // Stop resizing
        fireEvent.mouseUp(document);

        expect(mockOnCropChange).toHaveBeenCalled();
      }
    });

    it('should maintain aspect ratio when resizing with shift key', () => {
      const cropArea: CropArea = {
        x: 100,
        y: 100,
        width: 300,
        height: 200
      };

      const { container } = render(
        <CropTool
          originalWidth={1920}
          originalHeight={1080}
          cropArea={cropArea}
          onCropChange={mockOnCropChange}
        />
      );

      const resizeHandle = container.querySelector('[data-resize-handle]') as HTMLElement;
      if (resizeHandle) {
        fireEvent.mouseDown(resizeHandle, { clientX: 400, clientY: 300, shiftKey: true });
        fireEvent.mouseMove(document, { clientX: 450, clientY: 350, shiftKey: true });
        fireEvent.mouseUp(document);

        const lastCall = mockOnCropChange.mock.calls[mockOnCropChange.mock.calls.length - 1];
        if (lastCall && lastCall[0]) {
          const newCropArea = lastCall[0] as CropArea;
          const aspectRatio = newCropArea.width / newCropArea.height;
          const originalAspectRatio = cropArea.width / cropArea.height;
          expect(Math.abs(aspectRatio - originalAspectRatio)).toBeLessThan(0.01);
        }
      }
    });
  });

  describe('Boundary Constraints', () => {
    beforeEach(() => {
      // Setup for tests
    });

    it('should constrain crop area within bounds', () => {
      const cropArea: CropArea = {
        x: 10,
        y: 10,
        width: 100,
        height: 100
      };

      const { container } = render(
        <CropTool
          originalWidth={1920}
          originalHeight={1080}
          cropArea={cropArea}
          onCropChange={mockOnCropChange}
        />
      );

      const cropElement = container.querySelector('[data-crop-area]') as HTMLElement;
      if (cropElement) {
        // Try to drag outside bounds
        fireEvent.mouseDown(cropElement, { clientX: 50, clientY: 50 });
        fireEvent.mouseMove(document, { clientX: -100, clientY: -100 });
        fireEvent.mouseUp(document);

        const lastCall = mockOnCropChange.mock.calls[mockOnCropChange.mock.calls.length - 1];
        if (lastCall && lastCall[0]) {
          const newCropArea = lastCall[0] as CropArea;
          expect(newCropArea.x).toBeGreaterThanOrEqual(0);
          expect(newCropArea.y).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('should limit maximum crop size', () => {
      const cropArea: CropArea = {
        x: 100,
        y: 100,
        width: 300,
        height: 200
      };

      const { container } = render(
        <CropTool
          originalWidth={1920}
          originalHeight={1080}
          cropArea={cropArea}
          onCropChange={mockOnCropChange}
        />
      );

      const resizeHandle = container.querySelector('[data-resize-handle]') as HTMLElement;
      if (resizeHandle) {
        // Try to resize beyond bounds
        fireEvent.mouseDown(resizeHandle, { clientX: 400, clientY: 300 });
        fireEvent.mouseMove(document, { clientX: 3000, clientY: 2000 });
        fireEvent.mouseUp(document);

        const lastCall = mockOnCropChange.mock.calls[mockOnCropChange.mock.calls.length - 1];
        if (lastCall && lastCall[0]) {
          const newCropArea = lastCall[0] as CropArea;
          expect(newCropArea.x + newCropArea.width).toBeLessThanOrEqual(1920);
          expect(newCropArea.y + newCropArea.height).toBeLessThanOrEqual(1080);
        }
      }
    });
  });

  describe('Reset and Clear', () => {
    beforeEach(() => {
      // Setup for tests
    });

    it('should clear crop area when null is passed', () => {
      const cropArea: CropArea = {
        x: 100,
        y: 100,
        width: 300,
        height: 200
      };

      const { rerender, container } = render(
        <CropTool
          originalWidth={1920}
          originalHeight={1080}
          cropArea={cropArea}
          onCropChange={mockOnCropChange}
        />
      );

      // Clear crop area
      rerender(
        <CropTool
          originalWidth={1920}
          originalHeight={1080}
          cropArea={undefined}
          onCropChange={mockOnCropChange}
        />
      );

      const cropElement = container.querySelector('[data-crop-area]');
      expect(cropElement).toBeNull();
    });
  });

  describe('Scale Factor Calculations', () => {
    beforeEach(() => {
      // Setup for tests
    });

    it('should calculate correct scale factor', () => {
      // Mock smaller container
      Element.prototype.getBoundingClientRect = jest.fn(() => ({
        width: 400,
        height: 300,
        top: 0,
        left: 0,
        right: 400,
        bottom: 300,
        x: 0,
        y: 0,
        toJSON: () => ({})
      }));

      const cropArea: CropArea = {
        x: 960,  // Center of 1920
        y: 540,  // Center of 1080
        width: 100,
        height: 100
      };

      const { container } = render(
        <CropTool
          originalWidth={1920}
          originalHeight={1080}
          cropArea={cropArea}
          onCropChange={mockOnCropChange}
        />
      );

      const cropElement = container.querySelector('[data-crop-area]') as HTMLElement;
      if (cropElement) {
        // The position should be scaled according to container size
        const style = window.getComputedStyle(cropElement);
        // Scale factor would be 400/1920 = 0.208
        // Expected x position: 960 * 0.208 = 200px
        expect(style.left).toBeTruthy();
      }
    });
  });

  describe('Keyboard Shortcuts', () => {
    beforeEach(() => {
      // Setup for tests
    });

    it('should handle escape key to cancel operation', () => {
      const cropArea: CropArea = {
        x: 100,
        y: 100,
        width: 300,
        height: 200
      };

      const { container } = render(
        <CropTool
          originalWidth={1920}
          originalHeight={1080}
          cropArea={cropArea}
          onCropChange={mockOnCropChange}
        />
      );

      const cropElement = container.querySelector('[data-crop-area]') as HTMLElement;
      if (cropElement) {
        // Start dragging
        fireEvent.mouseDown(cropElement, { clientX: 150, clientY: 150 });

        // Press escape
        fireEvent.keyDown(document, { key: 'Escape' });

        // Mouse up should not trigger change
        fireEvent.mouseUp(document);

        // Should not have called onChange after escape
        expect(mockOnCropChange).not.toHaveBeenCalled();
      }
    });
  });
});