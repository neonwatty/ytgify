import * as React from "react"
import { cn } from "@/lib/utils"
import { GifSettings } from "@/types"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"

interface BasicControlPanelProps {
  settings: Partial<GifSettings>
  onSettingsChange: (settings: Partial<GifSettings>) => void
  className?: string
  disabled?: boolean
}

const RESOLUTION_OPTIONS = [
  { value: "480p", label: "480p (854×480)" },
  { value: "720p", label: "720p (1280×720)" },
  { value: "1080p", label: "1080p (1920×1080)" },
  { value: "original", label: "Original Quality" }
]

const QUALITY_OPTIONS = [
  { value: "low", label: "Low (Faster)" },
  { value: "medium", label: "Medium (Balanced)" },
  { value: "high", label: "High (Slower)" }
]

export const BasicControlPanel: React.FC<BasicControlPanelProps> = ({
  settings,
  onSettingsChange,
  className,
  disabled = false
}) => {
  const handleFrameRateChange = React.useCallback((value: number[]) => {
    onSettingsChange({ frameRate: value[0] })
  }, [onSettingsChange])

  const handleSpeedChange = React.useCallback((value: number[]) => {
    onSettingsChange({ speed: value[0] })
  }, [onSettingsChange])

  const handleResolutionChange = React.useCallback((value: string) => {
    onSettingsChange({ resolution: value })
  }, [onSettingsChange])

  const handleQualityChange = React.useCallback((value: string) => {
    onSettingsChange({ quality: value as 'low' | 'medium' | 'high' })
  }, [onSettingsChange])

  return (
    <div className={cn("space-y-6", className)}>
      {/* Frame Rate Control */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Frame Rate</label>
          <span className="text-sm text-muted-foreground">
            {settings.frameRate || 15} fps
          </span>
        </div>
        <Slider
          value={[settings.frameRate || 15]}
          onValueChange={handleFrameRateChange}
          min={5}
          max={30}
          step={1}
          disabled={disabled}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>5 fps</span>
          <span>30 fps</span>
        </div>
      </div>

      {/* Speed Control */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Playback Speed</label>
          <span className="text-sm text-muted-foreground">
            {settings.speed || 1}x
          </span>
        </div>
        <Slider
          value={[settings.speed || 1]}
          onValueChange={handleSpeedChange}
          min={0.25}
          max={4}
          step={0.25}
          disabled={disabled}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0.25x</span>
          <span>1x</span>
          <span>4x</span>
        </div>
      </div>

      {/* Resolution Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Resolution</label>
        <Select
          value={settings.resolution || "720p"}
          onValueChange={handleResolutionChange}
          disabled={disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select resolution" />
          </SelectTrigger>
          <SelectContent>
            {RESOLUTION_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Quality Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Quality</label>
        <Select
          value={settings.quality || "medium"}
          onValueChange={handleQualityChange}
          disabled={disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select quality" />
          </SelectTrigger>
          <SelectContent>
            {QUALITY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Settings Summary */}
      <div className="p-3 bg-muted/50 rounded-lg space-y-1">
        <h4 className="text-sm font-medium text-muted-foreground">Current Settings</h4>
        <div className="text-xs space-y-0.5">
          <div className="flex justify-between">
            <span>Frame Rate:</span>
            <span className="font-medium">{settings.frameRate || 15} fps</span>
          </div>
          <div className="flex justify-between">
            <span>Speed:</span>
            <span className="font-medium">{settings.speed || 1}x</span>
          </div>
          <div className="flex justify-between">
            <span>Resolution:</span>
            <span className="font-medium">{settings.resolution || "720p"}</span>
          </div>
          <div className="flex justify-between">
            <span>Quality:</span>
            <span className="font-medium capitalize">{settings.quality || "medium"}</span>
          </div>
        </div>
      </div>
    </div>
  )
}