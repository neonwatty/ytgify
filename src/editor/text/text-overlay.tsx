import * as React from 'react';
import { cn } from '@/lib/utils';
import { TextOverlay } from '@/types';

interface TextOverlayComponentProps {
  overlay: TextOverlay;
  onUpdate: (overlay: TextOverlay) => void;
  onSelect: (overlayId: string) => void;
  onDelete: (overlayId: string) => void;
  isSelected?: boolean;
  isEditing?: boolean;
  containerBounds?: DOMRect;
  className?: string;
  disabled?: boolean;
}

export const TextOverlayComponent: React.FC<TextOverlayComponentProps> = ({
  overlay,
  onUpdate,
  onSelect,
  onDelete,
  isSelected = false,
  containerBounds,
  className,
  disabled = false,
}) => {
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 });
  const [isEditingText, setIsEditingText] = React.useState(false);
  const [editText, setEditText] = React.useState(overlay.text);
  const textRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Handle drag start
  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      if (disabled || isEditingText) return;

      e.preventDefault();
      e.stopPropagation();

      onSelect(overlay.id);
      setIsDragging(true);

      const rect = e.currentTarget.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    },
    [disabled, isEditingText, onSelect, overlay.id]
  );

  // Handle drag move
  React.useEffect(() => {
    if (!isDragging || !containerBounds) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = Math.max(
        0,
        Math.min(
          containerBounds.width - 100, // Reserve space for text
          e.clientX - containerBounds.left - dragOffset.x
        )
      );
      const newY = Math.max(
        0,
        Math.min(
          containerBounds.height - 40, // Reserve space for text height
          e.clientY - containerBounds.top - dragOffset.y
        )
      );

      onUpdate({
        ...overlay,
        position: { x: newX, y: newY },
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, containerBounds, dragOffset, overlay, onUpdate]);

  // Handle double-click to edit text
  const handleDoubleClick = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (disabled) return;

      setIsEditingText(true);
      setEditText(overlay.text);
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    [disabled, overlay.text]
  );

  // Handle text edit completion
  const handleTextEditComplete = React.useCallback(() => {
    setIsEditingText(false);
    if (editText.trim() !== overlay.text) {
      onUpdate({
        ...overlay,
        text: editText.trim() || 'Text',
      });
    }
  }, [editText, overlay, onUpdate]);

  // Handle text edit key events
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleTextEditComplete();
      } else if (e.key === 'Escape') {
        setEditText(overlay.text);
        setIsEditingText(false);
      }
    },
    [overlay.text, handleTextEditComplete]
  );

  // Handle delete key
  React.useEffect(() => {
    if (!isSelected) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!isEditingText) {
          e.preventDefault();
          onDelete(overlay.id);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSelected, isEditingText, onDelete, overlay.id]);

  const getAnimationClasses = () => {
    switch (overlay.animation) {
      case 'fade-in':
        return 'animate-in fade-in duration-1000';
      case 'fade-out':
        return 'animate-out fade-out duration-1000';
      default:
        return '';
    }
  };

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    left: overlay.position.x,
    top: overlay.position.y,
    fontSize: overlay.fontSize,
    fontFamily: overlay.fontFamily,
    color: overlay.color,
    cursor: isDragging ? 'grabbing' : isEditingText ? 'text' : 'grab',
    zIndex: isSelected ? 20 : 10,
    userSelect: isEditingText ? 'text' : 'none',
    pointerEvents: disabled ? 'none' : 'auto',
  };

  return (
    <div
      ref={textRef}
      className={cn(
        'absolute select-none transition-all duration-200',
        isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-black/50',
        isDragging && 'scale-105 shadow-lg',
        getAnimationClasses(),
        className
      )}
      style={overlayStyle}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      data-overlay-id={overlay.id}
    >
      {isEditingText ? (
        <input
          ref={inputRef}
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={handleTextEditComplete}
          onKeyDown={handleKeyDown}
          className="bg-transparent border-none outline-none text-current font-inherit text-inherit"
          style={{
            fontSize: 'inherit',
            fontFamily: 'inherit',
            color: 'inherit',
            width: `${Math.max(editText.length * 0.6, 4)}ch`,
          }}
        />
      ) : (
        <span
          className="block whitespace-nowrap drop-shadow-lg"
          style={{
            textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
          }}
        >
          {overlay.text || 'Text'}
        </span>
      )}

      {/* Selection handles */}
      {isSelected && !isEditingText && (
        <>
          {/* Corner resize handles */}
          <div className="absolute -top-1 -left-1 w-2 h-2 bg-primary rounded-full cursor-nw-resize" />
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full cursor-ne-resize" />
          <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-primary rounded-full cursor-sw-resize" />
          <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-primary rounded-full cursor-se-resize" />

          {/* Delete button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(overlay.id);
            }}
            className="absolute -top-3 -right-3 w-6 h-6 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-full flex items-center justify-center text-xs transition-colors"
            title="Delete text overlay"
          >
            ×
          </button>
        </>
      )}
    </div>
  );
};

interface TextOverlayCanvasProps {
  overlays: TextOverlay[];
  onUpdateOverlay: (overlay: TextOverlay) => void;
  onSelectOverlay: (overlayId: string | null) => void;
  onDeleteOverlay: (overlayId: string) => void;
  selectedOverlayId?: string | null;
  className?: string;
  disabled?: boolean;
  children?: React.ReactNode;
}

export const TextOverlayCanvas: React.FC<TextOverlayCanvasProps> = ({
  overlays = [],
  onUpdateOverlay,
  onSelectOverlay,
  onDeleteOverlay,
  selectedOverlayId = null,
  className,
  disabled = false,
  children,
}) => {
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const [containerBounds, setContainerBounds] = React.useState<DOMRect | undefined>();

  // Update container bounds on resize
  React.useEffect(() => {
    if (!canvasRef.current) return;

    const updateBounds = () => {
      if (canvasRef.current) {
        setContainerBounds(canvasRef.current.getBoundingClientRect());
      }
    };

    updateBounds();

    const resizeObserver = new ResizeObserver(updateBounds);
    resizeObserver.observe(canvasRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  // Handle canvas click to deselect
  const handleCanvasClick = React.useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onSelectOverlay(null);
      }
    },
    [onSelectOverlay]
  );

  return (
    <div
      ref={canvasRef}
      className={cn('relative w-full h-full overflow-hidden bg-black/90 rounded-lg', className)}
      onClick={handleCanvasClick}
    >
      {children}

      {/* Text overlays */}
      {overlays.map((overlay) => (
        <TextOverlayComponent
          key={overlay.id}
          overlay={overlay}
          onUpdate={onUpdateOverlay}
          onSelect={onSelectOverlay}
          onDelete={onDeleteOverlay}
          isSelected={overlay.id === selectedOverlayId}
          containerBounds={containerBounds}
          disabled={disabled}
        />
      ))}

      {/* Overlay instructions when no overlays exist */}
      {overlays.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <div className="text-lg font-medium mb-2">No text overlays</div>
            <div className="text-sm">
              Click &quot;Add Text&quot; to create your first text overlay
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
