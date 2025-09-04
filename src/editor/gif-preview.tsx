import * as React from "react"
import { cn } from "@/lib/utils"
import { GifSettings } from "@/types"

interface GifPreviewProps {
  gifData?: Blob
  isLoading?: boolean
  settings?: Partial<GifSettings>
  className?: string
  onLoadComplete?: () => void
  onError?: (error: Error) => void
}

export const GifPreview: React.FC<GifPreviewProps> = ({
  gifData,
  isLoading = false,
  settings,
  className,
  onLoadComplete,
  onError
}) => {
  const [imageUrl, setImageUrl] = React.useState<string | null>(null)
  const [isPlaying, setIsPlaying] = React.useState(true)
  const [loopCount, setLoopCount] = React.useState(0)
  const imageRef = React.useRef<HTMLImageElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const animationFrameRef = React.useRef<number | null>(null)

  // Create object URL for the GIF blob
  React.useEffect(() => {
    if (gifData) {
      const url = URL.createObjectURL(gifData)
      setImageUrl(url)
      return () => URL.revokeObjectURL(url)
    }
  }, [gifData])

  // Pause GIF function
  const pauseGif = React.useCallback(() => {
    if (!imageRef.current || !containerRef.current) return

    const img = imageRef.current
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    ctx.drawImage(img, 0, 0)
    
    // Store the canvas as a data URL
    const dataUrl = canvas.toDataURL('image/png')
    img.dataset.pausedFrame = dataUrl
    img.src = dataUrl
  }, [])

  // Resume GIF function
  const resumeGif = React.useCallback(() => {
    if (!imageRef.current || !imageUrl) return
    
    const img = imageRef.current
    delete img.dataset.pausedFrame
    img.src = imageUrl
  }, [imageUrl])

  // Apply settings changes in real-time
  React.useEffect(() => {
    if (!imageRef.current || !settings) return

    const img = imageRef.current
    
    // Apply CSS filters based on settings
    const filters: string[] = []
    
    if (settings.brightness !== undefined && settings.brightness !== 1) {
      filters.push(`brightness(${settings.brightness})`)
    }
    
    if (settings.contrast !== undefined && settings.contrast !== 1) {
      filters.push(`contrast(${settings.contrast})`)
    }
    
    img.style.filter = filters.length > 0 ? filters.join(' ') : ''
    
    // Apply speed multiplier using CSS animation
    if (settings.speed !== undefined && settings.speed !== 1) {
      img.style.animationDuration = `${1 / settings.speed}s`
    }
  }, [settings])

  // Handle play/pause
  const togglePlayPause = React.useCallback(() => {
    if (!imageRef.current) return

    if (isPlaying) {
      // Pause the GIF by replacing it with a canvas frame
      pauseGif()
    } else {
      // Resume by restoring the original GIF
      resumeGif()
    }
    
    setIsPlaying(!isPlaying)
  }, [isPlaying, pauseGif, resumeGif])

  // Track loop count
  React.useEffect(() => {
    if (!imageRef.current || !isPlaying) return

    let startTime = Date.now()
    const duration = settings?.endTime && settings?.startTime 
      ? (settings.endTime - settings.startTime) * 1000 
      : 3000 // Default 3 seconds

    const checkLoop = () => {
      const elapsed = Date.now() - startTime
      
      if (elapsed >= duration) {
        setLoopCount(prev => prev + 1)
        startTime = Date.now()
      }
      
      if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(checkLoop)
      }
    }

    animationFrameRef.current = requestAnimationFrame(checkLoop)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isPlaying, settings])

  // Handle load complete
  const handleLoad = React.useCallback(() => {
    onLoadComplete?.()
  }, [onLoadComplete])

  // Handle error
  const handleError = React.useCallback(() => {
    onError?.(new Error('Failed to load GIF preview'))
  }, [onError])

  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative flex items-center justify-center bg-black/90 rounded-lg overflow-hidden",
        className
      )}
    >
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-8">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-sm text-muted-foreground">Generating preview...</p>
        </div>
      ) : imageUrl ? (
        <>
          <img
            ref={imageRef}
            src={imageUrl}
            alt="GIF Preview"
            className="max-w-full max-h-full object-contain"
            onLoad={handleLoad}
            onError={handleError}
          />
          
          {/* Overlay controls */}
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
            {/* Play/Pause button */}
            <button
              onClick={togglePlayPause}
              className="p-2 bg-black/50 hover:bg-black/70 rounded-full backdrop-blur-sm transition-colors"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                </svg>
              )}
            </button>
            
            {/* Loop indicator */}
            <div className="px-3 py-1 bg-black/50 backdrop-blur-sm rounded-full">
              <span className="text-white text-sm font-medium">
                Loop {loopCount}
              </span>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <svg className="w-16 h-16 text-muted-foreground mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm text-muted-foreground">No preview available</p>
          <p className="text-xs text-muted-foreground mt-1">Adjust settings to generate a preview</p>
        </div>
      )}
    </div>
  )
}

interface PreviewStatusProps {
  isGenerating?: boolean
  error?: string | null
  progress?: number
  className?: string
}

export const PreviewStatus: React.FC<PreviewStatusProps> = ({
  isGenerating = false,
  error,
  progress,
  className
}) => {
  if (!isGenerating && !error) return null

  return (
    <div className={cn(
      "flex items-center gap-2 p-2 rounded-md text-sm",
      error ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
      className
    )}>
      {isGenerating && !error && (
        <>
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span>Generating preview{progress ? ` (${Math.round(progress)}%)` : '...'}</span>
        </>
      )}
      
      {error && (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </>
      )}
    </div>
  )
}

interface PreviewMemoryIndicatorProps {
  memoryUsage?: number
  maxMemory?: number
  className?: string
}

export const PreviewMemoryIndicator: React.FC<PreviewMemoryIndicatorProps> = ({
  memoryUsage = 0,
  maxMemory = 100,
  className
}) => {
  const percentage = Math.min((memoryUsage / maxMemory) * 100, 100)
  const isHigh = percentage > 80
  const isCritical = percentage > 95

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Memory</span>
        <span className={cn(
          "font-medium",
          isCritical ? "text-destructive" : isHigh ? "text-yellow-600" : "text-muted-foreground"
        )}>
          {memoryUsage.toFixed(1)} / {maxMemory} MB
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div 
          className={cn(
            "h-full transition-all duration-300",
            isCritical ? "bg-destructive" : isHigh ? "bg-yellow-600" : "bg-primary"
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}