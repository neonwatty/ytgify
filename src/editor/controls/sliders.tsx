import * as React from "react"
import { cn } from "@/lib/utils"
import { GifSettings } from "@/types"
import { Slider } from "@/components/ui/slider"

interface SliderControlProps {
  label: string
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step: number
  unit?: string
  formatValue?: (value: number) => string
  className?: string
  disabled?: boolean
  description?: string
}

export const SliderControl: React.FC<SliderControlProps> = ({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit = "",
  formatValue,
  className,
  disabled = false,
  description
}) => {
  const handleChange = React.useCallback((values: number[]) => {
    onChange(values[0])
  }, [onChange])

  const displayValue = formatValue ? formatValue(value) : `${value}${unit}`

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        <span className="text-sm text-muted-foreground font-mono">
          {displayValue}
        </span>
      </div>
      
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      
      <Slider
        value={[value]}
        onValueChange={handleChange}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className="w-full"
      />
      
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  )
}

interface AdvancedSlidersProps {
  settings: Partial<GifSettings>
  onSettingsChange: (settings: Partial<GifSettings>) => void
  className?: string
  disabled?: boolean
}

export const AdvancedSliders: React.FC<AdvancedSlidersProps> = ({
  settings,
  onSettingsChange,
  className,
  disabled = false
}) => {
  const handleBrightnessChange = React.useCallback((value: number) => {
    onSettingsChange({ brightness: value })
  }, [onSettingsChange])

  const handleContrastChange = React.useCallback((value: number) => {
    onSettingsChange({ contrast: value })
  }, [onSettingsChange])

  const formatMultiplier = React.useCallback((value: number) => {
    return `${value.toFixed(2)}x`
  }, [])

  return (
    <div className={cn("space-y-6", className)}>
      {/* Brightness Control */}
      <SliderControl
        label="Brightness"
        value={settings.brightness || 1}
        onChange={handleBrightnessChange}
        min={0.1}
        max={2.5}
        step={0.1}
        formatValue={formatMultiplier}
        disabled={disabled}
        description="Adjust the overall brightness of the GIF"
      />

      {/* Contrast Control */}
      <SliderControl
        label="Contrast"
        value={settings.contrast || 1}
        onChange={handleContrastChange}
        min={0.1}
        max={2.5}
        step={0.1}
        formatValue={formatMultiplier}
        disabled={disabled}
        description="Adjust the contrast between light and dark areas"
      />

      {/* Visual Preview */}
      <div className="p-3 bg-muted/50 rounded-lg">
        <h4 className="text-sm font-medium text-muted-foreground mb-2">Filter Preview</h4>
        <div className="flex gap-3">
          <div className="flex-1">
            <div className="text-xs text-muted-foreground mb-1">Brightness</div>
            <div className="h-2 bg-gradient-to-r from-black via-gray-500 to-white rounded-full relative">
              <div 
                className="absolute top-0 h-2 w-1 bg-primary rounded-full transform -translate-x-0.5"
                style={{ 
                  left: `${Math.min(Math.max(((settings.brightness || 1) - 0.1) / 2.4 * 100, 0), 100)}%` 
                }}
              />
            </div>
          </div>
          <div className="flex-1">
            <div className="text-xs text-muted-foreground mb-1">Contrast</div>
            <div className="h-2 bg-gradient-to-r from-gray-400 via-black to-gray-400 rounded-full relative">
              <div 
                className="absolute top-0 h-2 w-1 bg-primary rounded-full transform -translate-x-0.5"
                style={{ 
                  left: `${Math.min(Math.max(((settings.contrast || 1) - 0.1) / 2.4 * 100, 0), 100)}%` 
                }}
              />
            </div>
          </div>
        </div>
        
        {/* CSS Filter String */}
        {(settings.brightness !== 1 || settings.contrast !== 1) && (
          <div className="mt-2 p-2 bg-muted rounded text-xs font-mono">
            filter: brightness({(settings.brightness || 1).toFixed(2)}) contrast({(settings.contrast || 1).toFixed(2)})
          </div>
        )}
      </div>
    </div>
  )
}

interface QuickPresetsProps {
  onApplyPreset: (settings: Partial<GifSettings>) => void
  className?: string
  disabled?: boolean
}

export const QuickPresets: React.FC<QuickPresetsProps> = ({
  onApplyPreset,
  className,
  disabled = false
}) => {
  const presets = React.useMemo(() => [
    {
      name: "Default",
      description: "Balanced settings for most content",
      settings: { brightness: 1, contrast: 1, frameRate: 15, speed: 1, quality: "medium" as const }
    },
    {
      name: "High Quality",
      description: "Maximum quality for detailed content",
      settings: { brightness: 1, contrast: 1.1, frameRate: 24, speed: 1, quality: "high" as const }
    },
    {
      name: "Fast & Light",
      description: "Smaller file size, faster loading",
      settings: { brightness: 1, contrast: 0.9, frameRate: 10, speed: 1, quality: "low" as const }
    },
    {
      name: "Bright & Vivid",
      description: "Enhanced colors and brightness",
      settings: { brightness: 1.3, contrast: 1.2, frameRate: 15, speed: 1, quality: "medium" as const }
    },
    {
      name: "Dark Mode",
      description: "Optimized for dark content",
      settings: { brightness: 0.8, contrast: 1.4, frameRate: 15, speed: 1, quality: "medium" as const }
    }
  ], [])

  return (
    <div className={cn("space-y-3", className)}>
      <h4 className="text-sm font-medium">Quick Presets</h4>
      <div className="grid grid-cols-1 gap-2">
        {presets.map((preset) => (
          <button
            key={preset.name}
            onClick={() => onApplyPreset(preset.settings)}
            disabled={disabled}
            className="p-3 text-left border border-border rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="font-medium text-sm">{preset.name}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {preset.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}