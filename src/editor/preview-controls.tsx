import * as React from "react"
import { cn } from "@/lib/utils"
import { GifSettings } from "@/types"

interface PreviewControlsProps {
  isPlaying: boolean
  loopCount: number
  currentTime?: number
  duration?: number
  settings?: Partial<GifSettings>
  onPlayPause: () => void
  onSeek?: (time: number) => void
  onReset?: () => void
  onExport?: () => void
  className?: string
}

export const PreviewControls: React.FC<PreviewControlsProps> = ({
  isPlaying,
  loopCount,
  currentTime = 0,
  duration = 0,
  settings,
  onPlayPause,
  onSeek,
  onReset,
  onExport,
  className
}) => {
  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek || duration === 0) return
    
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = x / rect.width
    const time = percentage * duration
    
    onSeek(Math.max(0, Math.min(time, duration)))
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Progress bar */}
      <div className="space-y-2">
        <div 
          className="relative h-2 bg-muted rounded-full cursor-pointer overflow-hidden group"
          onClick={handleProgressClick}
        >
          <div 
            className="absolute left-0 top-0 h-full bg-primary transition-all duration-100"
            style={{ width: `${progressPercentage}%` }}
          />
          <div 
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ left: `${progressPercentage}%`, transform: 'translateX(-50%) translateY(-50%)' }}
          />
        </div>
        
        {/* Time display */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Control buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Reset button */}
          {onReset && (
            <button
              onClick={onReset}
              className="p-2 hover:bg-accent rounded-md transition-colors"
              title="Reset"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
          
          {/* Play/Pause button */}
          <button
            onClick={onPlayPause}
            className="p-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              </svg>
            )}
          </button>

          {/* Loop indicator */}
          <div className="px-2 py-1 bg-accent rounded-md">
            <span className="text-sm font-medium">Loop {loopCount}</span>
          </div>
        </div>

        {/* Export button */}
        {onExport && (
          <button
            onClick={onExport}
            className="px-3 py-1.5 bg-accent hover:bg-accent/80 rounded-md transition-colors flex items-center gap-2"
            title="Export GIF"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span className="text-sm">Export</span>
          </button>
        )}
      </div>

      {/* Settings info */}
      {settings && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {settings.frameRate && (
            <span>{settings.frameRate} FPS</span>
          )}
          {settings.resolution && (
            <span>{settings.resolution}</span>
          )}
          {settings.quality && (
            <span className="capitalize">{settings.quality} quality</span>
          )}
          {settings.speed !== undefined && settings.speed !== 1 && (
            <span>{settings.speed}x speed</span>
          )}
        </div>
      )}
    </div>
  )
}

interface ControlButtonProps {
  icon: React.ReactNode
  label: string
  onClick: () => void
  isActive?: boolean
  disabled?: boolean
  className?: string
}

export const ControlButton: React.FC<ControlButtonProps> = ({
  icon,
  label,
  onClick,
  isActive = false,
  disabled = false,
  className
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "p-2 rounded-md transition-colors",
        isActive ? "bg-primary text-primary-foreground" : "hover:bg-accent",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      title={label}
      aria-label={label}
    >
      {icon}
    </button>
  )
}

interface SpeedControlProps {
  value: number
  onChange: (speed: number) => void
  className?: string
}

export const SpeedControl: React.FC<SpeedControlProps> = ({
  value,
  onChange,
  className
}) => {
  const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2]

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <span className="text-sm text-muted-foreground mr-2">Speed:</span>
      {speeds.map(speed => (
        <button
          key={speed}
          onClick={() => onChange(speed)}
          className={cn(
            "px-2 py-1 text-xs rounded-md transition-colors",
            value === speed 
              ? "bg-primary text-primary-foreground" 
              : "hover:bg-accent"
          )}
        >
          {speed}x
        </button>
      ))}
    </div>
  )
}

interface QualityControlProps {
  value: 'low' | 'medium' | 'high'
  onChange: (quality: 'low' | 'medium' | 'high') => void
  className?: string
}

export const QualityControl: React.FC<QualityControlProps> = ({
  value,
  onChange,
  className
}) => {
  const qualities: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high']

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <span className="text-sm text-muted-foreground mr-2">Quality:</span>
      {qualities.map(quality => (
        <button
          key={quality}
          onClick={() => onChange(quality)}
          className={cn(
            "px-3 py-1 text-xs rounded-md transition-colors capitalize",
            value === quality 
              ? "bg-primary text-primary-foreground" 
              : "hover:bg-accent"
          )}
        >
          {quality}
        </button>
      ))}
    </div>
  )
}

interface FrameRateControlProps {
  value: number
  onChange: (fps: number) => void
  min?: number
  max?: number
  className?: string
}

export const FrameRateControl: React.FC<FrameRateControlProps> = ({
  value,
  onChange,
  min = 5,
  max = 30,
  className
}) => {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Frame Rate</span>
        <span className="text-sm font-medium">{value} FPS</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{min} FPS</span>
        <span>{max} FPS</span>
      </div>
    </div>
  )
}

interface ResolutionControlProps {
  value: string
  onChange: (resolution: string) => void
  options?: string[]
  className?: string
}

export const ResolutionControl: React.FC<ResolutionControlProps> = ({
  value,
  onChange,
  options = ['360p', '480p', '720p', '1080p'],
  className
}) => {
  return (
    <div className={cn("space-y-2", className)}>
      <label className="text-sm text-muted-foreground">Resolution</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border rounded-md bg-background"
      >
        {options.map(resolution => (
          <option key={resolution} value={resolution}>
            {resolution}
          </option>
        ))}
      </select>
    </div>
  )
}