import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { TextOverlayComponent, TextOverlayCanvas } from '@/editor/text/text-overlay';
import type { TextOverlay } from '@/types';

// Mock components
jest.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' ')
}));

describe('TextOverlayComponent', () => {
  let mockOverlay: TextOverlay;
  let mockOnUpdate: jest.Mock;
  let mockOnSelect: jest.Mock;
  let mockOnDelete: jest.Mock;
  let mockContainerBounds: DOMRect;

  beforeEach(() => {
    mockOverlay = {
      id: 'test-overlay',
      text: 'Test Text',
      position: { x: 100, y: 100 },
      fontSize: 24,
      fontFamily: 'Arial',
      color: '#ffffff',
      animation: 'none'};

    mockOnUpdate = jest.fn();
    mockOnSelect = jest.fn();
    mockOnDelete = jest.fn();

    mockContainerBounds = {
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      right: 800,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: () => ({})
    };

    // Mock getBoundingClientRect
    Element.prototype.getBoundingClientRect = jest.fn(() => mockContainerBounds);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render text overlay with correct text', () => {
      render(
        <TextOverlayComponent
          overlay={mockOverlay}
          onUpdate={mockOnUpdate}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText('Test Text')).toBeTruthy();
    });

    it('should apply correct styles', () => {
      const { container } = render(
        <TextOverlayComponent
          overlay={mockOverlay}
          onUpdate={mockOnUpdate}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
        />
      );

      const overlayElement = container.querySelector('[data-overlay-id="test-overlay"]');
      expect(overlayElement).toBeTruthy();
      // Check individual style properties
      if (overlayElement) {
        const styles = window.getComputedStyle(overlayElement as Element);
        expect(styles.position).toBe('absolute');
        expect((overlayElement as HTMLElement).style.left).toBe('100px');
        expect((overlayElement as HTMLElement).style.top).toBe('100px');
        expect((overlayElement as HTMLElement).style.fontSize).toBe('24px');
        expect((overlayElement as HTMLElement).style.fontFamily).toBe('Arial');
      }
    });

    it('should show selection ring when selected', () => {
      const { container } = render(
        <TextOverlayComponent
          overlay={mockOverlay}
          onUpdate={mockOnUpdate}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
          isSelected={true}
        />
      );

      const overlayElement = container.querySelector('[data-overlay-id="test-overlay"]');
      expect(overlayElement?.className).toContain('ring-2');
      expect(overlayElement?.className).toContain('ring-primary');
    });

    it('should render delete button when selected', () => {
      render(
        <TextOverlayComponent
          overlay={mockOverlay}
          onUpdate={mockOnUpdate}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
          isSelected={true}
        />
      );

      const deleteButton = screen.getByTitle('Delete text overlay');
      expect(deleteButton).toBeTruthy();
    });

    it('should apply animation classes', () => {
      const animatedOverlay = { ...mockOverlay, animation: 'fade-in' as const };
      const { container } = render(
        <TextOverlayComponent
          overlay={animatedOverlay}
          onUpdate={mockOnUpdate}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
        />
      );

      const overlayElement = container.querySelector('[data-overlay-id="test-overlay"]');
      expect(overlayElement?.className).toContain('animate-in');
      expect(overlayElement?.className).toContain('fade-in');
    });
  });

  describe('Dragging', () => {
    it('should handle drag start on mouse down', () => {
      const { container } = render(
        <TextOverlayComponent
          overlay={mockOverlay}
          onUpdate={mockOnUpdate}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
          containerBounds={mockContainerBounds}
        />
      );

      const overlayElement = container.querySelector('[data-overlay-id="test-overlay"]') as HTMLElement;
      fireEvent.mouseDown(overlayElement, { clientX: 150, clientY: 150 });

      expect(mockOnSelect).toHaveBeenCalledWith('test-overlay');
    });

    it('should update position on drag', () => {
      const { container } = render(
        <TextOverlayComponent
          overlay={mockOverlay}
          onUpdate={mockOnUpdate}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
          containerBounds={mockContainerBounds}
        />
      );

      const overlayElement = container.querySelector('[data-overlay-id="test-overlay"]') as HTMLElement;

      // Start dragging
      fireEvent.mouseDown(overlayElement, { clientX: 150, clientY: 150 });

      // Move mouse
      fireEvent.mouseMove(document, { clientX: 200, clientY: 200 });

      // Check update was called with new position
      expect(mockOnUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          position: expect.objectContaining({
            x: expect.any(Number),
            y: expect.any(Number)
          })
        })
      );

      // Stop dragging
      fireEvent.mouseUp(document);
    });

    it('should constrain drag within container bounds', () => {
      const { container } = render(
        <TextOverlayComponent
          overlay={mockOverlay}
          onUpdate={mockOnUpdate}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
          containerBounds={mockContainerBounds}
        />
      );

      const overlayElement = container.querySelector('[data-overlay-id="test-overlay"]') as HTMLElement;

      // Start dragging
      fireEvent.mouseDown(overlayElement, { clientX: 150, clientY: 150 });

      // Try to drag outside bounds
      fireEvent.mouseMove(document, { clientX: 2000, clientY: 2000 });

      // Check position is constrained
      const updateCall = mockOnUpdate.mock.calls[0][0];
      expect((updateCall as any).position.x).toBeLessThanOrEqual(mockContainerBounds.width - 100);
      expect((updateCall as any).position.y).toBeLessThanOrEqual(mockContainerBounds.height - 40);
    });

    it('should not drag when disabled', () => {
      const { container } = render(
        <TextOverlayComponent
          overlay={mockOverlay}
          onUpdate={mockOnUpdate}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
          containerBounds={mockContainerBounds}
          disabled={true}
        />
      );

      const overlayElement = container.querySelector('[data-overlay-id="test-overlay"]') as HTMLElement;
      fireEvent.mouseDown(overlayElement, { clientX: 150, clientY: 150 });
      fireEvent.mouseMove(document, { clientX: 200, clientY: 200 });

      expect(mockOnSelect).not.toHaveBeenCalled();
      expect(mockOnUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Text Editing', () => {
    it('should enter edit mode on double click', () => {
      const { container } = render(
        <TextOverlayComponent
          overlay={mockOverlay}
          onUpdate={mockOnUpdate}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
        />
      );

      const overlayElement = container.querySelector('[data-overlay-id="test-overlay"]') as HTMLElement;
      fireEvent.doubleClick(overlayElement);

      const input = screen.getByDisplayValue('Test Text');
      expect(input).toBeTruthy();
    });

    it('should update text on Enter key', () => {
      const { container } = render(
        <TextOverlayComponent
          overlay={mockOverlay}
          onUpdate={mockOnUpdate}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
        />
      );

      const overlayElement = container.querySelector('[data-overlay-id="test-overlay"]') as HTMLElement;
      fireEvent.doubleClick(overlayElement);

      const input = screen.getByDisplayValue('Test Text') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'New Text' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'New Text'
        })
      );
    });

    it('should cancel edit on Escape key', () => {
      const { container } = render(
        <TextOverlayComponent
          overlay={mockOverlay}
          onUpdate={mockOnUpdate}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
        />
      );

      const overlayElement = container.querySelector('[data-overlay-id="test-overlay"]') as HTMLElement;
      fireEvent.doubleClick(overlayElement);

      const input = screen.getByDisplayValue('Test Text') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'New Text' } });
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(mockOnUpdate).not.toHaveBeenCalled();
      expect(screen.getByText('Test Text')).toBeTruthy();
    });

    it('should save text on blur', () => {
      const { container } = render(
        <TextOverlayComponent
          overlay={mockOverlay}
          onUpdate={mockOnUpdate}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
        />
      );

      const overlayElement = container.querySelector('[data-overlay-id="test-overlay"]') as HTMLElement;
      fireEvent.doubleClick(overlayElement);

      const input = screen.getByDisplayValue('Test Text') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'New Text' } });
      fireEvent.blur(input);

      expect(mockOnUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'New Text'
        })
      );
    });

    it('should trim whitespace from text', () => {
      const { container } = render(
        <TextOverlayComponent
          overlay={mockOverlay}
          onUpdate={mockOnUpdate}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
        />
      );

      const overlayElement = container.querySelector('[data-overlay-id="test-overlay"]') as HTMLElement;
      fireEvent.doubleClick(overlayElement);

      const input = screen.getByDisplayValue('Test Text') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '  New Text  ' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'New Text'
        })
      );
    });
  });

  describe('Deletion', () => {
    it('should delete on delete button click', () => {
      render(
        <TextOverlayComponent
          overlay={mockOverlay}
          onUpdate={mockOnUpdate}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
          isSelected={true}
        />
      );

      const deleteButton = screen.getByTitle('Delete text overlay');
      fireEvent.click(deleteButton);

      expect(mockOnDelete).toHaveBeenCalledWith('test-overlay');
    });

    it('should delete on Delete key when selected', () => {
      render(
        <TextOverlayComponent
          overlay={mockOverlay}
          onUpdate={mockOnUpdate}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
          isSelected={true}
        />
      );

      fireEvent.keyDown(document, { key: 'Delete' });

      expect(mockOnDelete).toHaveBeenCalledWith('test-overlay');
    });

    it('should delete on Backspace key when selected', () => {
      render(
        <TextOverlayComponent
          overlay={mockOverlay}
          onUpdate={mockOnUpdate}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
          isSelected={true}
        />
      );

      fireEvent.keyDown(document, { key: 'Backspace' });

      expect(mockOnDelete).toHaveBeenCalledWith('test-overlay');
    });

    it('should not delete when editing text', () => {
      const { container } = render(
        <TextOverlayComponent
          overlay={mockOverlay}
          onUpdate={mockOnUpdate}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
          isSelected={true}
        />
      );

      const overlayElement = container.querySelector('[data-overlay-id="test-overlay"]') as HTMLElement;
      fireEvent.doubleClick(overlayElement);

      fireEvent.keyDown(document, { key: 'Delete' });

      expect(mockOnDelete).not.toHaveBeenCalled();
    });
  });
});

describe('TextOverlayCanvas', () => {
  let mockOverlays: TextOverlay[];
  let mockOnUpdateOverlay: jest.Mock;
  let mockOnSelectOverlay: jest.Mock;
  let mockOnDeleteOverlay: jest.Mock;

  beforeEach(() => {
    mockOverlays = [
      {
        id: 'overlay-1',
        text: 'First Overlay',
        position: { x: 50, y: 50 },
        fontSize: 24,
        fontFamily: 'Arial',
        color: '#ffffff',
        animation: 'none'},
      {
        id: 'overlay-2',
        text: 'Second Overlay',
        position: { x: 200, y: 200 },
        fontSize: 32,
        fontFamily: 'Helvetica',
        color: '#ff0000',
        animation: 'fade-in'}
    ];

    mockOnUpdateOverlay = jest.fn();
    mockOnSelectOverlay = jest.fn();
    mockOnDeleteOverlay = jest.fn();

    // Mock ResizeObserver
    const mockObserve = jest.fn();
    const mockDisconnect = jest.fn();

    global.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: mockObserve,
      unobserve: jest.fn(),
      disconnect: mockDisconnect
    })) as any;

    // Store for test access
    (global as any).mockResizeObserverMethods = { observe: mockObserve, disconnect: mockDisconnect };

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

  describe('Canvas Rendering', () => {
    it('should render all overlays', () => {
      render(
        <TextOverlayCanvas
          overlays={mockOverlays}
          onUpdateOverlay={mockOnUpdateOverlay}
          onSelectOverlay={mockOnSelectOverlay}
          onDeleteOverlay={mockOnDeleteOverlay}
        />
      );

      expect(screen.getByText('First Overlay')).toBeTruthy();
      expect(screen.getByText('Second Overlay')).toBeTruthy();
    });

    it('should show empty state when no overlays', () => {
      render(
        <TextOverlayCanvas
          overlays={[]}
          onUpdateOverlay={mockOnUpdateOverlay}
          onSelectOverlay={mockOnSelectOverlay}
          onDeleteOverlay={mockOnDeleteOverlay}
        />
      );

      expect(screen.getByText('No text overlays')).toBeTruthy();
      expect(screen.getByText('Click "Add Text" to create your first text overlay')).toBeTruthy();
    });

    it('should render children', () => {
      render(
        <TextOverlayCanvas
          overlays={mockOverlays}
          onUpdateOverlay={mockOnUpdateOverlay}
          onSelectOverlay={mockOnSelectOverlay}
          onDeleteOverlay={mockOnDeleteOverlay}
        >
          <div data-testid="canvas-child">Child Content</div>
        </TextOverlayCanvas>
      );

      expect(screen.getByTestId('canvas-child')).toBeTruthy();
    });

    it('should apply custom className', () => {
      const { container } = render(
        <TextOverlayCanvas
          overlays={mockOverlays}
          onUpdateOverlay={mockOnUpdateOverlay}
          onSelectOverlay={mockOnSelectOverlay}
          onDeleteOverlay={mockOnDeleteOverlay}
          className="custom-canvas-class"
        />
      );

      const canvas = container.firstChild as HTMLElement;
      expect(canvas?.className).toContain('custom-canvas-class');
    });
  });

  describe('Selection Management', () => {
    it('should highlight selected overlay', () => {
      const { container } = render(
        <TextOverlayCanvas
          overlays={mockOverlays}
          onUpdateOverlay={mockOnUpdateOverlay}
          onSelectOverlay={mockOnSelectOverlay}
          onDeleteOverlay={mockOnDeleteOverlay}
          selectedOverlayId="overlay-1"
        />
      );

      const selectedOverlay = container.querySelector('[data-overlay-id="overlay-1"]');
      expect(selectedOverlay?.className).toContain('ring-2');
      expect(selectedOverlay?.className).toContain('ring-primary');

      const unselectedOverlay = container.querySelector('[data-overlay-id="overlay-2"]');
      expect(unselectedOverlay?.className).not.toContain('ring-2');
      expect(unselectedOverlay?.className).not.toContain('ring-primary');
    });

    it('should deselect overlay on canvas click', () => {
      const { container } = render(
        <TextOverlayCanvas
          overlays={mockOverlays}
          onUpdateOverlay={mockOnUpdateOverlay}
          onSelectOverlay={mockOnSelectOverlay}
          onDeleteOverlay={mockOnDeleteOverlay}
          selectedOverlayId="overlay-1"
        />
      );

      const canvas = container.firstChild as HTMLElement;
      fireEvent.click(canvas);

      expect(mockOnSelectOverlay).toHaveBeenCalledWith(null);
    });

    it('should select overlay on overlay click', () => {
      const { container } = render(
        <TextOverlayCanvas
          overlays={mockOverlays}
          onUpdateOverlay={mockOnUpdateOverlay}
          onSelectOverlay={mockOnSelectOverlay}
          onDeleteOverlay={mockOnDeleteOverlay}
        />
      );

      const overlay = container.querySelector('[data-overlay-id="overlay-2"]') as HTMLElement;
      fireEvent.mouseDown(overlay);

      expect(mockOnSelectOverlay).toHaveBeenCalledWith('overlay-2');
    });
  });

  describe('Container Bounds', () => {
    it('should update container bounds on resize', () => {
      const { container } = render(
        <TextOverlayCanvas
          overlays={mockOverlays}
          onUpdateOverlay={mockOnUpdateOverlay}
          onSelectOverlay={mockOnSelectOverlay}
          onDeleteOverlay={mockOnDeleteOverlay}
        />
      );

      const canvas = container.firstChild as HTMLElement;

      // Verify ResizeObserver was set up
      expect(global.ResizeObserver).toHaveBeenCalled();
      const { observe } = (global as any).mockResizeObserverMethods;
      expect(observe).toHaveBeenCalledWith(canvas);
    });

    it('should disconnect ResizeObserver on unmount', () => {
      const { unmount } = render(
        <TextOverlayCanvas
          overlays={mockOverlays}
          onUpdateOverlay={mockOnUpdateOverlay}
          onSelectOverlay={mockOnSelectOverlay}
          onDeleteOverlay={mockOnDeleteOverlay}
        />
      );

      const { disconnect } = (global as any).mockResizeObserverMethods;

      unmount();

      expect(disconnect).toHaveBeenCalled();
    });
  });

  describe('Disabled State', () => {
    it('should disable all overlays when canvas is disabled', () => {
      const { container } = render(
        <TextOverlayCanvas
          overlays={mockOverlays}
          onUpdateOverlay={mockOnUpdateOverlay}
          onSelectOverlay={mockOnSelectOverlay}
          onDeleteOverlay={mockOnDeleteOverlay}
          disabled={true}
        />
      );

      const overlay = container.querySelector('[data-overlay-id="overlay-1"]') as HTMLElement;

      // Try to interact with overlay
      fireEvent.mouseDown(overlay);
      fireEvent.mouseMove(document, { clientX: 200, clientY: 200 });

      expect(mockOnSelectOverlay).not.toHaveBeenCalled();
      expect(mockOnUpdateOverlay).not.toHaveBeenCalled();
    });
  });

  describe('Update Propagation', () => {
    it('should propagate update events from overlays', () => {
      const { container } = render(
        <TextOverlayCanvas
          overlays={mockOverlays}
          onUpdateOverlay={mockOnUpdateOverlay}
          onSelectOverlay={mockOnSelectOverlay}
          onDeleteOverlay={mockOnDeleteOverlay}
        />
      );

      const overlay = container.querySelector('[data-overlay-id="overlay-1"]') as HTMLElement;

      // Double click to edit
      fireEvent.doubleClick(overlay);

      // Update text
      const input = screen.getByDisplayValue('First Overlay') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'Updated Text' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnUpdateOverlay).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'overlay-1',
          text: 'Updated Text'
        })
      );
    });

    it('should propagate delete events from overlays', () => {
      render(
        <TextOverlayCanvas
          overlays={mockOverlays}
          onUpdateOverlay={mockOnUpdateOverlay}
          onSelectOverlay={mockOnSelectOverlay}
          onDeleteOverlay={mockOnDeleteOverlay}
          selectedOverlayId="overlay-1"
        />
      );

      fireEvent.keyDown(document, { key: 'Delete' });

      expect(mockOnDeleteOverlay).toHaveBeenCalledWith('overlay-1');
    });
  });
});