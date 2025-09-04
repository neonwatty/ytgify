/**
 * Advanced Processing Panel
 * Exposes sophisticated quality management, optimization features, and processing options
 */

import * as React from "react"
import { cn } from "@/lib/utils"
import { GifSettings, TimelineSelection } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  QualityManager, 
  FRAME_RATE_PROFILES, 
  QUALITY_PROFILES,
  QualityRecommendation 
} from "@/processing/quality-manager"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface AdvancedProcessingPanelProps {
  settings: Partial<GifSettings>
  onSettingsChange: (settings: Partial<GifSettings>) => void
  selection?: TimelineSelection
  videoMetadata?: {
    originalFrameRate: number
    resolution: { width: number; height: number }
    bitrate?: number
  }
  className?: string
  disabled?: boolean
}

export const AdvancedProcessingPanel: React.FC<AdvancedProcessingPanelProps> = ({
  settings,
  onSettingsChange,
  selection,
  videoMetadata,
  className,
  disabled = false
}) => {
  const qualityManager = React.useMemo(() => new QualityManager(), [])
  const [recommendation, setRecommendation] = React.useState<QualityRecommendation | null>(null)
  const [targetFileSize, setTargetFileSize] = React.useState<string>("")
  const [optimizationResult, setOptimizationResult] = React.useState<{
    optimizedSettings: GifSettings
    estimatedFileSize: number
    reductionSteps: string[]
  } | null>(null)

  // Generate quality recommendations when selection or settings change
  React.useEffect(() => {
    if (selection && settings.frameRate && settings.quality && settings.resolution) {
      const rec = qualityManager.analyzeContent(selection, videoMetadata)
      setRecommendation(rec)
    }
  }, [qualityManager, selection, videoMetadata, settings])

  const qualitySummary = React.useMemo(() => {
    if (!settings.frameRate || !settings.quality || !settings.resolution || !settings.startTime || !settings.endTime) {
      return null
    }
    return qualityManager.getQualitySummary(settings as GifSettings)
  }, [qualityManager, settings])

  const handleApplyRecommendation = React.useCallback(() => {
    if (!recommendation) return
    
    onSettingsChange({
      frameRate: recommendation.recommendedFrameRate,
      quality: recommendation.recommendedQuality,
      resolution: recommendation.recommendedResolution
    })
  }, [recommendation, onSettingsChange])

  const handleFrameRateProfileChange = React.useCallback((fpsValue: string) => {
    const fps = parseInt(fpsValue)
    onSettingsChange({ frameRate: fps })
  }, [onSettingsChange])

  const handleOptimizeForFileSize = React.useCallback(async () => {
    if (!targetFileSize || !settings.frameRate || !settings.quality || !settings.resolution || !settings.startTime || !settings.endTime) {
      return
    }

    const targetBytes = parseFloat(targetFileSize) * 1024 * 1024 // Convert MB to bytes
    if (isNaN(targetBytes) || targetBytes <= 0) return

    const result = qualityManager.optimizeForFileSize(
      settings as GifSettings,
      targetBytes,
      10 // 10% tolerance
    )

    setOptimizationResult(result)
  }, [qualityManager, settings, targetFileSize])

  const handleApplyOptimization = React.useCallback(() => {
    if (!optimizationResult) return
    
    onSettingsChange({
      frameRate: optimizationResult.optimizedSettings.frameRate,
      quality: optimizationResult.optimizedSettings.quality,
      resolution: optimizationResult.optimizedSettings.resolution
    })
    
    setOptimizationResult(null)
  }, [optimizationResult, onSettingsChange])

  return (
    <div className={cn("space-y-6", className)}>
      {/* Quality Analysis & Recommendations */}
      {recommendation && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">🎯 Smart Recommendations</CardTitle>
            <CardDescription>
              AI-powered optimization based on your video content
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center p-2 bg-muted rounded">
                <div className="font-medium">{recommendation.recommendedFrameRate} fps</div>
                <div className="text-xs text-muted-foreground">Frame Rate</div>
              </div>
              <div className="text-center p-2 bg-muted rounded">
                <div className="font-medium capitalize">{recommendation.recommendedQuality}</div>
                <div className="text-xs text-muted-foreground">Quality</div>
              </div>
              <div className="text-center p-2 bg-muted rounded">
                <div className="font-medium">{recommendation.recommendedResolution}</div>
                <div className="text-xs text-muted-foreground">Resolution</div>
              </div>
            </div>
            
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Analysis:</div>
              <ul className="text-xs space-y-0.5">
                {recommendation.reasoning.map((reason, index) => (
                  <li key={index} className="flex items-start gap-1">
                    <span className="text-muted-foreground">•</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Button 
              size="sm" 
              onClick={handleApplyRecommendation}
              disabled={disabled}
              className="w-full"
            >
              Apply Recommended Settings
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Frame Rate Profiles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">📱 Frame Rate Profiles</CardTitle>
          <CardDescription>
            Pre-configured frame rates optimized for different content types
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            value={settings.frameRate?.toString() || "12"}
            onValueChange={handleFrameRateProfileChange}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select frame rate profile" />
            </SelectTrigger>
            <SelectContent>
              {FRAME_RATE_PROFILES.map((profile) => (
                <SelectItem key={profile.fps} value={profile.fps.toString()}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{profile.fps} fps</span>
                    <span className="text-muted-foreground">- {profile.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {settings.frameRate && (
            <div className="p-3 bg-muted/50 rounded text-xs space-y-1">
              {(() => {
                const profile = FRAME_RATE_PROFILES.find(p => p.fps === settings.frameRate)
                return profile ? (
                  <>
                    <div className="font-medium">{profile.name} ({profile.fps} fps)</div>
                    <div className="text-muted-foreground">{profile.description}</div>
                    <div className="text-muted-foreground">
                      Best for: {profile.suitableFor.join(', ')}
                    </div>
                  </>
                ) : null
              })()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* File Size Optimization */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">📏 File Size Optimization</CardTitle>
          <CardDescription>
            Automatically adjust settings to meet target file size
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Target size (MB)"
              value={targetFileSize}
              onChange={(e) => setTargetFileSize(e.target.value)}
              disabled={disabled}
              className="flex-1"
              min="0.1"
              max="50"
              step="0.1"
            />
            <Button
              onClick={handleOptimizeForFileSize}
              disabled={disabled || !targetFileSize}
            >
              Optimize
            </Button>
          </div>

          {optimizationResult && (
            <div className="space-y-3">
              <Alert>
                <AlertDescription>
                  <div className="space-y-2">
                    <div className="font-medium">
                      Optimized for {(optimizationResult.estimatedFileSize / (1024 * 1024)).toFixed(1)} MB
                    </div>
                    <div className="text-sm">
                      <div className="font-medium mb-1">Changes made:</div>
                      <ul className="space-y-0.5">
                        {optimizationResult.reductionSteps.map((step, index) => (
                          <li key={index} className="flex items-start gap-1">
                            <span className="text-muted-foreground">•</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleApplyOptimization}
                  disabled={disabled}
                  className="flex-1"
                >
                  Apply Optimization
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setOptimizationResult(null)}
                  disabled={disabled}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quality Summary */}
      {qualitySummary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">📊 Processing Preview</CardTitle>
            <CardDescription>
              Estimated output characteristics with current settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-sm font-medium">File Size</div>
                <div className="text-lg font-semibold text-primary">
                  {qualitySummary.estimatedFileSize}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium">Encoding Time</div>
                <div className="text-lg font-semibold text-primary">
                  {qualitySummary.estimatedEncodingTime}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Current Profile</div>
              <div className="p-2 bg-muted rounded text-sm">
                <div className="font-medium">
                  {qualitySummary.frameRateProfile.name} • {qualitySummary.qualityProfile.name}
                </div>
                <div className="text-muted-foreground text-xs mt-1">
                  {qualitySummary.frameRateProfile.description}
                </div>
              </div>
            </div>

            {qualitySummary.recommendations.length > 0 && (
              <div className="space-y-1">
                <div className="text-sm font-medium text-amber-600">Suggestions</div>
                <ul className="text-xs space-y-0.5">
                  {qualitySummary.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start gap-1">
                      <span className="text-amber-500">⚠</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}