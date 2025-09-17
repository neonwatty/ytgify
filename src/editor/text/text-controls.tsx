import * as React from 'react';
import { cn } from '@/lib/utils';
import { TextOverlay } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface TextControlsProps {
  overlays: TextOverlay[];
  selectedOverlayId?: string | null;
  onUpdateOverlay: (overlay: TextOverlay) => void;
  onAddOverlay: () => void;
  onDeleteOverlay: (overlayId: string) => void;
  onSelectOverlay: (overlayId: string | null) => void;
  className?: string;
  disabled?: boolean;
}

const FONT_FAMILIES = [
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Helvetica, sans-serif', label: 'Helvetica' },
  { value: 'Times New Roman, serif', label: 'Times New Roman' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Verdana, sans-serif', label: 'Verdana' },
  { value: 'Courier New, monospace', label: 'Courier New' },
  { value: 'Impact, sans-serif', label: 'Impact' },
  { value: 'Comic Sans MS, cursive', label: 'Comic Sans MS' },
  { value: 'Trebuchet MS, sans-serif', label: 'Trebuchet MS' },
  { value: 'Tahoma, sans-serif', label: 'Tahoma' },
];

const PRESET_COLORS = [
  '#FFFFFF', // White
  '#000000', // Black
  '#FF0000', // Red
  '#00FF00', // Green
  '#0000FF', // Blue
  '#FFFF00', // Yellow
  '#FF00FF', // Magenta
  '#00FFFF', // Cyan
  '#FFA500', // Orange
  '#800080', // Purple
  '#FFC0CB', // Pink
  '#A52A2A', // Brown
];

const ANIMATION_OPTIONS = [
  { value: 'none', label: 'Static' },
  { value: 'fade-in', label: 'Fade In' },
  { value: 'fade-out', label: 'Fade Out' },
];

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ color, onChange, disabled = false }) => {
  const [customColor, setCustomColor] = React.useState(color);

  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    setCustomColor(newColor);
    onChange(newColor);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full h-10 p-2" disabled={disabled}>
          <div className="w-full h-full rounded border" style={{ backgroundColor: color }} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4">
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-3">Color Presets</h4>
            <div className="grid grid-cols-6 gap-2">
              {PRESET_COLORS.map((presetColor) => (
                <button
                  key={presetColor}
                  className={cn(
                    'w-8 h-8 rounded border-2 transition-all',
                    color === presetColor
                      ? 'border-primary scale-110'
                      : 'border-muted hover:border-muted-foreground'
                  )}
                  style={{ backgroundColor: presetColor }}
                  onClick={() => onChange(presetColor)}
                />
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">Custom Color</h4>
            <div className="flex gap-2">
              <Input
                type="color"
                value={customColor}
                onChange={handleCustomColorChange}
                className="w-16 h-10 p-1 cursor-pointer"
              />
              <Input
                type="text"
                value={customColor}
                onChange={(e) => {
                  setCustomColor(e.target.value);
                  onChange(e.target.value);
                }}
                placeholder="#FFFFFF"
                className="flex-1"
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export const TextControls: React.FC<TextControlsProps> = ({
  overlays,
  selectedOverlayId,
  onUpdateOverlay,
  onAddOverlay,
  onDeleteOverlay,
  onSelectOverlay,
  className,
  disabled = false,
}) => {
  const selectedOverlay = React.useMemo(
    () => overlays.find((overlay) => overlay.id === selectedOverlayId),
    [overlays, selectedOverlayId]
  );

  const handleTextChange = React.useCallback(
    (text: string) => {
      if (!selectedOverlay) return;
      onUpdateOverlay({
        ...selectedOverlay,
        text: text || 'Text',
      });
    },
    [selectedOverlay, onUpdateOverlay]
  );

  const handleFontSizeChange = React.useCallback(
    (fontSize: number[]) => {
      if (!selectedOverlay) return;
      onUpdateOverlay({
        ...selectedOverlay,
        fontSize: fontSize[0],
      });
    },
    [selectedOverlay, onUpdateOverlay]
  );

  const handleFontFamilyChange = React.useCallback(
    (fontFamily: string) => {
      if (!selectedOverlay) return;
      onUpdateOverlay({
        ...selectedOverlay,
        fontFamily,
      });
    },
    [selectedOverlay, onUpdateOverlay]
  );

  const handleColorChange = React.useCallback(
    (color: string) => {
      if (!selectedOverlay) return;
      onUpdateOverlay({
        ...selectedOverlay,
        color,
      });
    },
    [selectedOverlay, onUpdateOverlay]
  );

  const handleAnimationChange = React.useCallback(
    (animation: string) => {
      if (!selectedOverlay) return;
      onUpdateOverlay({
        ...selectedOverlay,
        animation: animation as 'none' | 'fade-in' | 'fade-out',
      });
    },
    [selectedOverlay, onUpdateOverlay]
  );

  const moveOverlay = React.useCallback(
    (direction: 'up' | 'down') => {
      if (!selectedOverlay) return;

      const currentIndex = overlays.findIndex((o) => o.id === selectedOverlay.id);
      if (currentIndex === -1) return;

      const newIndex =
        direction === 'up'
          ? Math.max(0, currentIndex - 1)
          : Math.min(overlays.length - 1, currentIndex + 1);

      if (newIndex === currentIndex) return;

      // This would require a reordering mechanism in the parent component
      // For now, we'll just update the position slightly to indicate the action
      const offset = direction === 'up' ? -1 : 1;
      onUpdateOverlay({
        ...selectedOverlay,
        position: {
          x: selectedOverlay.position.x,
          y: Math.max(0, selectedOverlay.position.y + offset),
        },
      });
    },
    [selectedOverlay, overlays, onUpdateOverlay]
  );

  return (
    <div className={cn('space-y-6', className)}>
      {/* Add Text Button */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Text Overlays</h3>
        <Button onClick={onAddOverlay} disabled={disabled} variant="default" size="sm">
          Add Text
        </Button>
      </div>

      {/* Text Layers List */}
      {overlays.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Layers ({overlays.length})</h4>
          <div className="space-y-1">
            {overlays.map((overlay, index) => (
              <div
                key={overlay.id}
                className={cn(
                  'flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors',
                  overlay.id === selectedOverlayId
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground'
                )}
                onClick={() => onSelectOverlay(overlay.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {overlay.text || `Text ${index + 1}`}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {overlay.fontFamily.split(',')[0]} • {overlay.fontSize}px
                  </div>
                </div>
                <div
                  className="w-4 h-4 rounded border"
                  style={{ backgroundColor: overlay.color }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteOverlay(overlay.id);
                  }}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                  disabled={disabled}
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Text Properties */}
      {selectedOverlay && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground">Text Properties</h4>

          {/* Text Content */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Text</label>
            <Input
              value={selectedOverlay.text}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="Enter text..."
              disabled={disabled}
            />
          </div>

          {/* Font Family */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Font Family</label>
            <Select
              value={selectedOverlay.fontFamily}
              onValueChange={handleFontFamilyChange}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_FAMILIES.map((font) => (
                  <SelectItem key={font.value} value={font.value}>
                    <span style={{ fontFamily: font.value }}>{font.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Font Size */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Font Size</label>
              <span className="text-sm text-muted-foreground">{selectedOverlay.fontSize}px</span>
            </div>
            <Slider
              value={[selectedOverlay.fontSize]}
              onValueChange={handleFontSizeChange}
              min={12}
              max={72}
              step={1}
              disabled={disabled}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>12px</span>
              <span>72px</span>
            </div>
          </div>

          {/* Color */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Color</label>
            <ColorPicker
              color={selectedOverlay.color}
              onChange={handleColorChange}
              disabled={disabled}
            />
          </div>

          {/* Animation */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Animation</label>
            <Select
              value={selectedOverlay.animation || 'none'}
              onValueChange={handleAnimationChange}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANIMATION_OPTIONS.map((animation) => (
                  <SelectItem key={animation.value} value={animation.value}>
                    {animation.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Layer Controls */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Layer Order</label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => moveOverlay('up')}
                disabled={disabled}
                className="flex-1"
              >
                Move Up
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => moveOverlay('down')}
                disabled={disabled}
                className="flex-1"
              >
                Move Down
              </Button>
            </div>
          </div>

          {/* Position */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Position</label>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between">
                <span>X:</span>
                <span className="font-mono">{Math.round(selectedOverlay.position.x)}px</span>
              </div>
              <div className="flex justify-between">
                <span>Y:</span>
                <span className="font-mono">{Math.round(selectedOverlay.position.y)}px</span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Drag the text on the canvas to reposition
            </div>
          </div>
        </div>
      )}

      {/* Help text when no text selected */}
      {!selectedOverlay && overlays.length > 0 && (
        <div className="p-4 bg-muted/50 rounded-lg text-center">
          <div className="text-sm text-muted-foreground">
            Select a text overlay to edit its properties
          </div>
        </div>
      )}

      {/* Help text when no overlays exist */}
      {overlays.length === 0 && (
        <div className="p-4 bg-muted/50 rounded-lg text-center">
          <div className="text-sm text-muted-foreground">
            No text overlays yet. Click &quot;Add Text&quot; to get started.
          </div>
        </div>
      )}
    </div>
  );
};
