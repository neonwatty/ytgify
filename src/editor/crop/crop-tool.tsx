import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CropToolProps {
  originalWidth: number;
  originalHeight: number;
  cropArea?: CropArea;
  onCropChange: (cropArea: CropArea | null) => void;
  className?: string;
  disabled?: boolean;
  children?: React.ReactNode;
}

const DEFAULT_CROP_AREA: CropArea = {
  x: 50,
  y: 50,
  width: 200,
  height: 150,
};

export const CropTool: React.FC<CropToolProps> = ({
  originalWidth,
  originalHeight,
  cropArea,
  onCropChange,
  className,
  disabled = false,
  children,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isResizing, setIsResizing] = React.useState<string | null>(null);
  const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 });
  const [containerBounds, setContainerBounds] = React.useState<DOMRect | null>(null);

  // Update container bounds on mount and resize
  React.useEffect(() => {
    if (!containerRef.current) return;

    const updateBounds = () => {
      if (containerRef.current) {
        setContainerBounds(containerRef.current.getBoundingClientRect());
      }
    };

    updateBounds();

    const resizeObserver = new ResizeObserver(updateBounds);
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  // Calculate scale factor between displayed container and original dimensions
  const scaleFactor = React.useMemo(() => {
    if (!containerBounds) return 1;
    return Math.min(containerBounds.width / originalWidth, containerBounds.height / originalHeight);
  }, [containerBounds, originalWidth, originalHeight]);

  // Handle mouse down on crop area (start dragging)
  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      if (disabled || !cropArea || !containerBounds) return;

      e.preventDefault();
      e.stopPropagation();

      const rect = e.currentTarget.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      setIsDragging(true);
    },
    [disabled, cropArea, containerBounds]
  );

  // Handle mouse down on resize handles
  const handleResizeStart = React.useCallback(
    (e: React.MouseEvent, direction: string) => {
      if (disabled || !cropArea) return;

      e.preventDefault();
      e.stopPropagation();
      setIsResizing(direction);
    },
    [disabled, cropArea]
  );

  // Handle mouse movement for dragging and resizing
  React.useEffect(() => {
    if ((!isDragging && !isResizing) || !cropArea || !containerBounds) return;

    const handleMouseMove = (e: MouseEvent) => {
      const containerX = e.clientX - containerBounds.left;
      const containerY = e.clientY - containerBounds.top;

      if (isDragging) {
        // Calculate new position
        const newX = Math.max(
          0,
          Math.min(containerBounds.width - cropArea.width, containerX - dragOffset.x)
        );
        const newY = Math.max(
          0,
          Math.min(containerBounds.height - cropArea.height, containerY - dragOffset.y)
        );

        onCropChange({
          ...cropArea,
          x: newX,
          y: newY,
        });
      } else if (isResizing) {
        // Calculate new dimensions based on resize direction
        let newCrop = { ...cropArea };

        switch (isResizing) {
          case 'nw': {
            // Northwest
            const nwWidth = cropArea.width + (cropArea.x - containerX);
            const nwHeight = cropArea.height + (cropArea.y - containerY);
            if (nwWidth > 50 && nwHeight > 50) {
              newCrop = {
                x: Math.max(0, containerX),
                y: Math.max(0, containerY),
                width: Math.min(nwWidth, cropArea.x + cropArea.width),
                height: Math.min(nwHeight, cropArea.y + cropArea.height),
              };
            }
            break;
          }

          case 'ne': {
            // Northeast
            const neWidth = containerX - cropArea.x;
            const neHeight = cropArea.height + (cropArea.y - containerY);
            if (neWidth > 50 && neHeight > 50) {
              newCrop = {
                ...cropArea,
                y: Math.max(0, containerY),
                width: Math.min(neWidth, containerBounds.width - cropArea.x),
                height: Math.min(neHeight, cropArea.y + cropArea.height),
              };
            }
            break;
          }

          case 'sw': {
            // Southwest
            const swWidth = cropArea.width + (cropArea.x - containerX);
            const swHeight = containerY - cropArea.y;
            if (swWidth > 50 && swHeight > 50) {
              newCrop = {
                x: Math.max(0, containerX),
                y: cropArea.y,
                width: Math.min(swWidth, cropArea.x + cropArea.width),
                height: Math.min(swHeight, containerBounds.height - cropArea.y),
              };
            }
            break;
          }

          case 'se': {
            // Southeast
            newCrop = {
              ...cropArea,
              width: Math.max(
                50,
                Math.min(containerX - cropArea.x, containerBounds.width - cropArea.x)
              ),
              height: Math.max(
                50,
                Math.min(containerY - cropArea.y, containerBounds.height - cropArea.y)
              ),
            };
            break;
          }
        }

        onCropChange(newCrop);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, cropArea, containerBounds, dragOffset, onCropChange]);

  // Calculate crop area in original coordinates
  const originalCropArea = React.useMemo(() => {
    if (!cropArea) return null;
    return {
      x: Math.round(cropArea.x / scaleFactor),
      y: Math.round(cropArea.y / scaleFactor),
      width: Math.round(cropArea.width / scaleFactor),
      height: Math.round(cropArea.height / scaleFactor),
    };
  }, [cropArea, scaleFactor]);

  // Handle preset crop ratios
  const applyCropRatio = React.useCallback(
    (ratio: number) => {
      if (!containerBounds) return;

      const maxWidth = containerBounds.width * 0.8;
      const maxHeight = containerBounds.height * 0.8;

      let width, height;
      if (ratio > 1) {
        // Landscape
        width = maxWidth;
        height = maxWidth / ratio;
      } else {
        // Portrait or square
        height = maxHeight;
        width = maxHeight * ratio;
      }

      const x = (containerBounds.width - width) / 2;
      const y = (containerBounds.height - height) / 2;

      onCropChange({ x, y, width, height });
    },
    [containerBounds, onCropChange]
  );

  const handleReset = React.useCallback(() => {
    onCropChange(null);
  }, [onCropChange]);

  const handleSetDefault = React.useCallback(() => {
    onCropChange(DEFAULT_CROP_AREA);
  }, [onCropChange]);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Crop Area Display */}
      <div
        ref={containerRef}
        className="relative w-full h-96 bg-black/90 rounded-lg overflow-hidden border-2 border-muted"
        onClick={() => !cropArea && handleSetDefault()}
      >
        {children}

        {/* Crop Selection Overlay */}
        {cropArea && (
          <>
            {/* Overlay masks */}
            <div className="absolute inset-0 bg-black/60 pointer-events-none" />

            {/* Crop area */}
            <div
              className={cn(
                'absolute border-2 border-primary bg-transparent cursor-move',
                isDragging && 'cursor-grabbing'
              )}
              style={{
                left: cropArea.x,
                top: cropArea.y,
                width: cropArea.width,
                height: cropArea.height,
              }}
              onMouseDown={handleMouseDown}
            >
              {/* Clear inner area */}
              <div className="absolute inset-0 bg-black/0 backdrop-blur-none" />

              {/* Resize handles */}
              {!disabled && (
                <>
                  {/* Corner handles */}
                  <div
                    className="absolute -top-1 -left-1 w-3 h-3 bg-primary border border-primary-foreground cursor-nw-resize rounded-sm"
                    onMouseDown={(e) => handleResizeStart(e, 'nw')}
                  />
                  <div
                    className="absolute -top-1 -right-1 w-3 h-3 bg-primary border border-primary-foreground cursor-ne-resize rounded-sm"
                    onMouseDown={(e) => handleResizeStart(e, 'ne')}
                  />
                  <div
                    className="absolute -bottom-1 -left-1 w-3 h-3 bg-primary border border-primary-foreground cursor-sw-resize rounded-sm"
                    onMouseDown={(e) => handleResizeStart(e, 'sw')}
                  />
                  <div
                    className="absolute -bottom-1 -right-1 w-3 h-3 bg-primary border border-primary-foreground cursor-se-resize rounded-sm"
                    onMouseDown={(e) => handleResizeStart(e, 'se')}
                  />

                  {/* Edge handles */}
                  <div className="absolute top-1/2 -left-1 w-2 h-6 bg-primary border border-primary-foreground cursor-w-resize rounded-sm transform -translate-y-1/2" />
                  <div className="absolute top-1/2 -right-1 w-2 h-6 bg-primary border border-primary-foreground cursor-e-resize rounded-sm transform -translate-y-1/2" />
                  <div className="absolute left-1/2 -top-1 w-6 h-2 bg-primary border border-primary-foreground cursor-n-resize rounded-sm transform -translate-x-1/2" />
                  <div className="absolute left-1/2 -bottom-1 w-6 h-2 bg-primary border border-primary-foreground cursor-s-resize rounded-sm transform -translate-x-1/2" />
                </>
              )}

              {/* Crop area info */}
              <div className="absolute top-2 left-2 bg-black/75 text-white text-xs px-2 py-1 rounded">
                {originalCropArea?.width} × {originalCropArea?.height}
              </div>
            </div>
          </>
        )}

        {/* Instructions when no crop area */}
        {!cropArea && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <div className="text-lg font-medium mb-2">No crop area selected</div>
              <div className="text-sm">
                Click anywhere to start cropping, or use the controls below
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Crop Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Aspect Ratio Presets */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Ratio:</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyCropRatio(16 / 9)}
            disabled={disabled}
            className="h-7 px-2 text-xs"
          >
            16:9
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyCropRatio(4 / 3)}
            disabled={disabled}
            className="h-7 px-2 text-xs"
          >
            4:3
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyCropRatio(1)}
            disabled={disabled}
            className="h-7 px-2 text-xs"
          >
            1:1
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => applyCropRatio(9 / 16)}
            disabled={disabled}
            className="h-7 px-2 text-xs"
          >
            9:16
          </Button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {!cropArea && (
            <Button
              variant="default"
              size="sm"
              onClick={handleSetDefault}
              disabled={disabled}
              className="h-7 px-3 text-xs"
            >
              Start Cropping
            </Button>
          )}

          {cropArea && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={disabled}
              className="h-7 px-3 text-xs"
            >
              Clear Crop
            </Button>
          )}
        </div>
      </div>

      {/* Crop Information */}
      {originalCropArea && (
        <div className="p-3 bg-muted/50 rounded-lg">
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Crop Information</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Position
              </div>
              <div className="font-mono">
                X: {originalCropArea.x}px
                <br />
                Y: {originalCropArea.y}px
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Dimensions
              </div>
              <div className="font-mono">
                W: {originalCropArea.width}px
                <br />
                H: {originalCropArea.height}px
              </div>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
            Aspect ratio: {(originalCropArea.width / originalCropArea.height).toFixed(2)}:1
          </div>
        </div>
      )}
    </div>
  );
};
