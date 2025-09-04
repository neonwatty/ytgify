import * as React from "react"
import { cn } from "@/lib/utils"
import { GifSettings } from "@/types"
import { Button } from "@/components/ui/button"
import { SliderControl } from "./sliders"

interface VisualAdjustmentPanelProps {
  settings: Partial<GifSettings>
  onSettingsChange: (settings: Partial<GifSettings>) => void
  className?: string
  disabled?: boolean
}

const DEFAULT_SETTINGS: Pick<GifSettings, 'brightness' | 'contrast' | 'speed'> = {
  brightness: 1,
  contrast: 1,
  speed: 1
}

export const VisualAdjustmentPanel: React.FC<VisualAdjustmentPanelProps> = ({
  settings,
  onSettingsChange,
  className,
  disabled = false
}) => {
  const handleBrightnessChange = React.useCallback((brightness: number) => {
    onSettingsChange({ brightness })
  }, [onSettingsChange])

  const handleContrastChange = React.useCallback((contrast: number) => {
    onSettingsChange({ contrast })
  }, [onSettingsChange])

  const handleSpeedChange = React.useCallback((speed: number) => {
    onSettingsChange({ speed })
  }, [onSettingsChange])

  const handleResetAll = React.useCallback(() => {
    onSettingsChange(DEFAULT_SETTINGS)
  }, [onSettingsChange])

  const handleResetBrightness = React.useCallback(() => {
    onSettingsChange({ brightness: DEFAULT_SETTINGS.brightness })
  }, [onSettingsChange])

  const handleResetContrast = React.useCallback(() => {
    onSettingsChange({ contrast: DEFAULT_SETTINGS.contrast })
  }, [onSettingsChange])

  const handleResetSpeed = React.useCallback(() => {
    onSettingsChange({ speed: DEFAULT_SETTINGS.speed })
  }, [onSettingsChange])

  const formatMultiplier = React.useCallback((value: number) => {
    return `${value.toFixed(2)}x`
  }, [])

  const isModified = React.useMemo(() => {
    return (
      settings.brightness !== DEFAULT_SETTINGS.brightness ||
      settings.contrast !== DEFAULT_SETTINGS.contrast ||
      settings.speed !== DEFAULT_SETTINGS.speed
    )
  }, [settings])

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header with Reset All */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Visual Adjustments</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={handleResetAll}
          disabled={disabled || !isModified}
          className="h-8 px-3"
        >
          Reset All
        </Button>
      </div>

      {/* Brightness Control */}
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Brightness</label>
            {settings.brightness !== DEFAULT_SETTINGS.brightness && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetBrightness}
                disabled={disabled}
                className="h-5 w-5 p-0 text-xs"
                title="Reset to default"
              >
                ↺
              </Button>
            )}
          </div>
          <span className="text-sm text-muted-foreground font-mono">
            {formatMultiplier(settings.brightness || DEFAULT_SETTINGS.brightness)}
          </span>
        </div>
        
        <SliderControl
          label=""
          value={settings.brightness || DEFAULT_SETTINGS.brightness}
          onChange={handleBrightnessChange}
          min={0.1}
          max={2.5}
          step={0.1}
          formatValue={formatMultiplier}
          disabled={disabled}
          description="Adjust the overall brightness of the video"
        />

        {/* Brightness Preview Bar */}
        <div className="mt-2 h-2 bg-gradient-to-r from-black via-gray-500 to-white rounded-full relative">
          <div 
            className="absolute top-0 h-2 w-1 bg-primary rounded-full transform -translate-x-0.5"
            style={{ 
              left: `${Math.min(Math.max(((settings.brightness || 1) - 0.1) / 2.4 * 100, 0), 100)}%` 
            }}
          />
        </div>
      </div>

      {/* Contrast Control */}
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Contrast</label>
            {settings.contrast !== DEFAULT_SETTINGS.contrast && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetContrast}
                disabled={disabled}
                className="h-5 w-5 p-0 text-xs"
                title="Reset to default"
              >
                ↺
              </Button>
            )}
          </div>
          <span className="text-sm text-muted-foreground font-mono">
            {formatMultiplier(settings.contrast || DEFAULT_SETTINGS.contrast)}
          </span>
        </div>
        
        <SliderControl
          label=""
          value={settings.contrast || DEFAULT_SETTINGS.contrast}
          onChange={handleContrastChange}
          min={0.1}
          max={2.5}
          step={0.1}
          formatValue={formatMultiplier}
          disabled={disabled}
          description="Adjust the contrast between light and dark areas"
        />

        {/* Contrast Preview Bar */}
        <div className="mt-2 h-2 bg-gradient-to-r from-gray-400 via-black to-gray-400 rounded-full relative">
          <div 
            className="absolute top-0 h-2 w-1 bg-primary rounded-full transform -translate-x-0.5"
            style={{ 
              left: `${Math.min(Math.max(((settings.contrast || 1) - 0.1) / 2.4 * 100, 0), 100)}%` 
            }}
          />
        </div>
      </div>

      {/* Playback Speed Control */}
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Playback Speed</label>
            {settings.speed !== DEFAULT_SETTINGS.speed && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetSpeed}
                disabled={disabled}
                className="h-5 w-5 p-0 text-xs"
                title="Reset to default"
              >
                ↺
              </Button>
            )}
          </div>
          <span className="text-sm text-muted-foreground font-mono">
            {formatMultiplier(settings.speed || DEFAULT_SETTINGS.speed)}
          </span>
        </div>
        
        <SliderControl
          label=""
          value={settings.speed || DEFAULT_SETTINGS.speed}
          onChange={handleSpeedChange}
          min={0.25}
          max={4}
          step={0.25}
          formatValue={formatMultiplier}
          disabled={disabled}
          description="Adjust the playback speed of the GIF"
        />

        {/* Speed Visual Indicators */}
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <div className="flex flex-col items-center">
            <span>🐌</span>
            <span>0.25x</span>
          </div>
          <div className="flex flex-col items-center">
            <span>🚶</span>
            <span>1x</span>
          </div>
          <div className="flex flex-col items-center">
            <span>🏃</span>
            <span>4x</span>
          </div>
        </div>
      </div>

      {/* Live Filter Preview */}
      <div className="p-4 bg-muted/50 rounded-lg">
        <h4 className="text-sm font-medium text-muted-foreground mb-3">Live Preview</h4>
        
        {/* Sample Image with Applied Filters */}
        <div className="relative overflow-hidden rounded border">
          <div 
            className="w-full h-24 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-300"
            style={{
              filter: `brightness(${settings.brightness || 1}) contrast(${settings.contrast || 1})`
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white/80 text-sm font-medium drop-shadow-lg">
              Preview Sample
            </span>
          </div>
        </div>

        {/* Applied Filters Summary */}
        <div className="mt-3 space-y-1">
          <div className="text-xs text-muted-foreground">Applied filters:</div>
          <div className="font-mono text-xs bg-background p-2 rounded border">
            filter: brightness({(settings.brightness || 1).toFixed(2)}) contrast({(settings.contrast || 1).toFixed(2)});
            <br />
            animation-duration: {(1 / (settings.speed || 1)).toFixed(2)}s;
          </div>
        </div>
      </div>

      {/* Presets Section */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">Quick Presets</h4>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSettingsChange({ brightness: 1.3, contrast: 1.2, speed: 1 })}
            disabled={disabled}
            className="h-auto p-3 flex flex-col items-start"
          >
            <span className="font-medium text-xs">Bright & Vivid</span>
            <span className="text-xs text-muted-foreground">Enhanced colors</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onSettingsChange({ brightness: 0.8, contrast: 1.4, speed: 1 })}
            disabled={disabled}
            className="h-auto p-3 flex flex-col items-start"
          >
            <span className="font-medium text-xs">Dark Mode</span>
            <span className="text-xs text-muted-foreground">Low light optimized</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onSettingsChange({ brightness: 1, contrast: 1, speed: 2 })}
            disabled={disabled}
            className="h-auto p-3 flex flex-col items-start"
          >
            <span className="font-medium text-xs">Fast Motion</span>
            <span className="text-xs text-muted-foreground">2x speed</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onSettingsChange({ brightness: 1, contrast: 1, speed: 0.5 })}
            disabled={disabled}
            className="h-auto p-3 flex flex-col items-start"
          >
            <span className="font-medium text-xs">Slow Motion</span>
            <span className="text-xs text-muted-foreground">0.5x speed</span>
          </Button>
        </div>
      </div>

      {/* Advanced Options */}
      <div className="pt-4 border-t">
        <details className="group">
          <summary className="flex items-center justify-between cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Advanced Options
            <span className="transition-transform group-open:rotate-180">▼</span>
          </summary>
          
          <div className="mt-4 space-y-4">
            {/* Fine-tune controls or additional options can be added here */}
            <div className="text-xs text-muted-foreground">
              Fine-tune controls and additional visual adjustments will be available here.
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSettingsChange({ brightness: 1.1, contrast: 1.1 })}
                disabled={disabled}
                className="text-xs"
              >
                Subtle Enhancement
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSettingsChange({ brightness: 0.9, contrast: 0.9 })}
                disabled={disabled}
                className="text-xs"
              >
                Subtle Reduction
              </Button>
            </div>
          </div>
        </details>
      </div>
    </div>
  )
}