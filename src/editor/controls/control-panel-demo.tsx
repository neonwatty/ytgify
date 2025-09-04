import * as React from "react"
import { cn } from "@/lib/utils"
import { GifSettings } from "@/types"
import { BasicControlPanel } from "./basic-panel"
import { AdvancedSliders, QuickPresets } from "./sliders"
import { EditorSection, EditorGrid, ResponsiveContainer } from "../layout"

interface ControlPanelDemoProps {
  initialSettings?: Partial<GifSettings>
  onSettingsChange?: (settings: Partial<GifSettings>) => void
  className?: string
  disabled?: boolean
}

export const ControlPanelDemo: React.FC<ControlPanelDemoProps> = ({
  initialSettings = {},
  onSettingsChange,
  className,
  disabled = false
}) => {
  const [settings, setSettings] = React.useState<Partial<GifSettings>>({
    frameRate: 15,
    speed: 1,
    resolution: "720p",
    quality: "medium",
    brightness: 1,
    contrast: 1,
    ...initialSettings
  })

  const [lastChanged, setLastChanged] = React.useState<string | null>(null)
  const [changeCount, setChangeCount] = React.useState(0)

  // Real-time feedback - trigger callback immediately when settings change
  React.useEffect(() => {
    onSettingsChange?.(settings)
  }, [settings, onSettingsChange])

  const handleSettingsChange = React.useCallback((newSettings: Partial<GifSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings }
      
      // Track what changed for feedback
      const changedKeys = Object.keys(newSettings)
      if (changedKeys.length > 0) {
        setLastChanged(changedKeys[0])
        setChangeCount(prev => prev + 1)
        
        // Clear the highlight after a short delay
        setTimeout(() => setLastChanged(null), 1000)
      }
      
      return updated
    })
  }, [])

  const handlePresetApply = React.useCallback((presetSettings: Partial<GifSettings>) => {
    setSettings(prev => ({ ...prev, ...presetSettings }))
    setLastChanged("preset")
    setChangeCount(prev => prev + 1)
    setTimeout(() => setLastChanged(null), 1500)
  }, [])

  const resetSettings = React.useCallback(() => {
    setSettings({
      frameRate: 15,
      speed: 1,
      resolution: "720p",
      quality: "medium",
      brightness: 1,
      contrast: 1
    })
    setLastChanged("reset")
    setChangeCount(prev => prev + 1)
    setTimeout(() => setLastChanged(null), 1000)
  }, [])

  return (
    <div className={cn("space-y-6", className)}>
      {/* Real-time Status */}
      <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-2 h-2 rounded-full transition-colors",
            lastChanged ? "bg-green-500 animate-pulse" : "bg-muted-foreground"
          )} />
          <span className="text-sm font-medium">
            Real-time Feedback {lastChanged ? "Active" : "Ready"}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          Changes: {changeCount}
          {lastChanged && (
            <span className="ml-2 px-2 py-1 bg-primary/10 text-primary rounded">
              {lastChanged === "preset" ? "Preset Applied" : 
               lastChanged === "reset" ? "Settings Reset" :
               `${lastChanged} updated`}
            </span>
          )}
        </div>
      </div>

      <ResponsiveContainer>
        {/* Basic Controls */}
        <EditorSection 
          title="Basic Settings" 
          description="Essential controls for GIF creation"
          className="flex-1"
        >
          <BasicControlPanel
            settings={settings}
            onSettingsChange={handleSettingsChange}
            disabled={disabled}
          />
        </EditorSection>

        {/* Advanced Controls */}
        <EditorSection 
          title="Visual Adjustments" 
          description="Fine-tune the appearance of your GIF"
          className="flex-1"
        >
          <AdvancedSliders
            settings={settings}
            onSettingsChange={handleSettingsChange}
            disabled={disabled}
          />
        </EditorSection>
      </ResponsiveContainer>

      {/* Quick Presets */}
      <EditorSection 
        title="Quick Presets" 
        description="Apply predefined settings for common use cases"
      >
        <div className="flex gap-4">
          <div className="flex-1">
            <QuickPresets
              onApplyPreset={handlePresetApply}
              disabled={disabled}
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={resetSettings}
              disabled={disabled}
              className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reset All
            </button>
          </div>
        </div>
      </EditorSection>

      {/* Live Settings Preview */}
      <EditorSection 
        title="Live Settings" 
        description="Current configuration that will be applied to your GIF"
      >
        <div className="p-4 bg-muted/20 rounded-lg font-mono text-sm space-y-2">
          <EditorGrid columns={2}>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Performance</div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>Frame Rate:</span>
                  <span className="font-bold">{settings.frameRate} fps</span>
                </div>
                <div className="flex justify-between">
                  <span>Speed:</span>
                  <span className="font-bold">{settings.speed}x</span>
                </div>
                <div className="flex justify-between">
                  <span>Quality:</span>
                  <span className="font-bold capitalize">{settings.quality}</span>
                </div>
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Appearance</div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>Resolution:</span>
                  <span className="font-bold">{settings.resolution}</span>
                </div>
                <div className="flex justify-between">
                  <span>Brightness:</span>
                  <span className="font-bold">{settings.brightness?.toFixed(2)}x</span>
                </div>
                <div className="flex justify-between">
                  <span>Contrast:</span>
                  <span className="font-bold">{settings.contrast?.toFixed(2)}x</span>
                </div>
              </div>
            </div>
          </EditorGrid>

          {/* Estimated Output Info */}
          <div className="mt-4 p-3 bg-background border rounded">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Estimated Output</div>
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-muted-foreground">File Size:</span>
                <div className="font-bold">~{Math.round((settings.frameRate || 15) * (settings.quality === 'high' ? 100 : settings.quality === 'medium' ? 60 : 30))}KB</div>
              </div>
              <div>
                <span className="text-muted-foreground">Processing:</span>
                <div className="font-bold">{settings.quality === 'high' ? 'Slow' : settings.quality === 'medium' ? 'Medium' : 'Fast'}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Loops:</span>
                <div className="font-bold">Infinite</div>
              </div>
            </div>
          </div>
        </div>
      </EditorSection>
    </div>
  )
}