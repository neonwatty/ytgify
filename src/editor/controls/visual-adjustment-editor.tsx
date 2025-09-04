import * as React from "react"
import { cn } from "@/lib/utils"
import { GifSettings } from "@/types"
import { VisualAdjustmentPanel } from "./visual-panel"
import { CropTool } from "../crop/crop-tool"
import { ResponsiveContainer, EditorSection } from "../layout"
import { Button } from "@/components/ui/button"

interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

interface ExtendedGifSettings extends GifSettings {
  cropArea?: CropArea | null
}

interface VisualAdjustmentEditorProps {
  settings: Partial<ExtendedGifSettings>
  onSettingsChange: (settings: Partial<ExtendedGifSettings>) => void
  originalWidth?: number
  originalHeight?: number
  className?: string
  disabled?: boolean
  previewContent?: React.ReactNode
}

export const VisualAdjustmentEditor: React.FC<VisualAdjustmentEditorProps> = ({
  settings,
  onSettingsChange,
  originalWidth = 1920,
  originalHeight = 1080,
  className,
  disabled = false,
  previewContent
}) => {
  const [activeTab, setActiveTab] = React.useState<'adjustments' | 'crop'>('adjustments')

  const handleVisualSettingsChange = React.useCallback((visualSettings: Partial<GifSettings>) => {
    onSettingsChange({ ...settings, ...visualSettings })
  }, [settings, onSettingsChange])

  const handleCropChange = React.useCallback((cropArea: CropArea | null) => {
    onSettingsChange({ ...settings, cropArea })
  }, [settings, onSettingsChange])

  const handleResetAll = React.useCallback(() => {
    onSettingsChange({
      brightness: 1,
      contrast: 1,
      speed: 1,
      cropArea: null
    })
  }, [onSettingsChange])

  const hasAnyChanges = React.useMemo(() => {
    return (
      settings.brightness !== 1 ||
      settings.contrast !== 1 ||
      settings.speed !== 1 ||
      settings.cropArea !== null
    )
  }, [settings])

  return (
    <div className={cn("h-full", className)}>
      <ResponsiveContainer direction="row" className="h-full">
        {/* Main Canvas Area */}
        <div className="flex-1 flex flex-col">
          <EditorSection 
            title="Visual Adjustments" 
            description="Adjust brightness, contrast, speed, and crop your GIF"
            className="flex-1 flex flex-col"
          >
            {/* Tab Navigation */}
            <div className="flex items-center gap-1 mb-6 border-b">
              <Button
                variant={activeTab === 'adjustments' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('adjustments')}
                className="rounded-b-none"
              >
                Visual Adjustments
              </Button>
              <Button
                variant={activeTab === 'crop' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('crop')}
                className="rounded-b-none"
              >
                Crop Tool
                {settings.cropArea && (
                  <span className="ml-2 w-2 h-2 bg-primary rounded-full" />
                )}
              </Button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 min-h-0">
              {activeTab === 'adjustments' && (
                <div className="h-full">
                  {/* Visual Preview with Applied Effects */}
                  <div className="mb-6">
                    <div
                      className="w-full h-64 rounded-lg overflow-hidden border-2 border-muted relative"
                      style={{
                        filter: `brightness(${settings.brightness || 1}) contrast(${settings.contrast || 1})`
                      }}
                    >
                      {previewContent || (
                        <div className="w-full h-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center">
                          <div className="text-white/80 text-xl font-bold drop-shadow-lg">
                            PREVIEW
                          </div>
                        </div>
                      )}

                      {/* Speed indicator overlay */}
                      {settings.speed !== 1 && (
                        <div className="absolute top-4 right-4 bg-black/75 text-white px-3 py-1 rounded text-sm font-medium">
                          {settings.speed}x Speed
                        </div>
                      )}

                      {/* Crop indicator overlay */}
                      {settings.cropArea && (
                        <div className="absolute bottom-4 left-4 bg-black/75 text-white px-3 py-1 rounded text-sm font-medium">
                          Cropped: {Math.round(settings.cropArea.width)} × {Math.round(settings.cropArea.height)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Current Settings Summary */}
                  <div className="mb-6 p-4 bg-muted/30 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium">Current Settings</h4>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleResetAll}
                        disabled={disabled || !hasAnyChanges}
                        className="h-6 px-2 text-xs"
                      >
                        Reset All
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground">Brightness</div>
                        <div className="font-mono font-bold">
                          {(settings.brightness || 1).toFixed(2)}x
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground">Contrast</div>
                        <div className="font-mono font-bold">
                          {(settings.contrast || 1).toFixed(2)}x
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-muted-foreground">Speed</div>
                        <div className="font-mono font-bold">
                          {(settings.speed || 1).toFixed(2)}x
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'crop' && (
                <CropTool
                  originalWidth={originalWidth}
                  originalHeight={originalHeight}
                  cropArea={settings.cropArea || undefined}
                  onCropChange={handleCropChange}
                  disabled={disabled}
                >
                  {previewContent || (
                    <div className="w-full h-full bg-gradient-to-br from-green-500 via-blue-500 to-purple-500 flex items-center justify-center">
                      <div className="text-white/80 text-xl font-bold drop-shadow-lg">
                        VIDEO PREVIEW
                      </div>
                    </div>
                  )}
                </CropTool>
              )}
            </div>

            {/* Footer Info */}
            <div className="flex items-center justify-between pt-4 border-t text-sm text-muted-foreground">
              <div>
                {activeTab === 'adjustments' && (
                  <span>Real-time visual adjustments with live preview</span>
                )}
                {activeTab === 'crop' && (
                  <span>
                    {settings.cropArea 
                      ? `Crop area: ${Math.round(settings.cropArea.width)} × ${Math.round(settings.cropArea.height)}`
                      : 'No crop area selected'
                    }
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-4">
                <span>Original: {originalWidth} × {originalHeight}</span>
                {hasAnyChanges && (
                  <span className="text-primary font-medium">• Modified</span>
                )}
              </div>
            </div>
          </EditorSection>
        </div>

        {/* Controls Sidebar */}
        <div className="w-80 border-l bg-background">
          <div className="p-6 h-full overflow-y-auto">
            <VisualAdjustmentPanel
              settings={settings}
              onSettingsChange={handleVisualSettingsChange}
              disabled={disabled}
            />

            {/* Crop Quick Actions */}
            {activeTab === 'crop' && (
              <div className="mt-6 pt-6 border-t">
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Crop Actions</h4>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab('adjustments')}
                    className="w-full justify-start"
                  >
                    ← Back to Adjustments
                  </Button>
                  
                  {settings.cropArea && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCropChange(null)}
                      disabled={disabled}
                      className="w-full justify-start text-destructive hover:text-destructive"
                    >
                      Clear Crop Area
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Integration Tips */}
            <div className="mt-6 pt-6 border-t">
              <div className="p-3 bg-muted/30 rounded-lg text-xs text-muted-foreground">
                <div className="font-medium mb-2">Tips:</div>
                <ul className="space-y-1">
                  <li>• Brightness: 0.1x (very dark) to 2.5x (very bright)</li>
                  <li>• Contrast: 0.1x (flat) to 2.5x (high contrast)</li>
                  <li>• Speed: 0.25x (slow) to 4x (fast)</li>
                  <li>• Crop: Drag corners to resize, center to move</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </ResponsiveContainer>
    </div>
  )
}

// Demo component with sample content
interface VisualAdjustmentEditorDemoProps {
  className?: string
  disabled?: boolean
}

export const VisualAdjustmentEditorDemo: React.FC<VisualAdjustmentEditorDemoProps> = ({
  className,
  disabled = false
}) => {
  const [settings, setSettings] = React.useState<Partial<ExtendedGifSettings>>({
    brightness: 1,
    contrast: 1,
    speed: 1,
    cropArea: null
  })

  // Sample preview content
  const previewContent = (
    <div className="w-full h-full relative">
      <div className="w-full h-full bg-gradient-to-br from-orange-400 via-red-500 to-pink-500" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-white text-2xl font-bold drop-shadow-xl">
          Demo Video Frame
        </div>
      </div>
      <div className="absolute top-4 left-4 text-white text-sm bg-black/50 px-2 py-1 rounded">
        1920 × 1080
      </div>
    </div>
  )

  return (
    <VisualAdjustmentEditor
      settings={settings}
      onSettingsChange={setSettings}
      originalWidth={1920}
      originalHeight={1080}
      previewContent={previewContent}
      className={className}
      disabled={disabled}
    />
  )
}