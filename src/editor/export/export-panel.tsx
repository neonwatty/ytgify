import * as React from "react"
import { cn } from "@/lib/utils"
import { GifData, GifSettings } from "@/types"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { MetadataForm } from "./metadata-form"
import { ResponsiveContainer, EditorSection } from "../layout"
import { clipboardManager } from "@/utils/clipboard-manager"
import { SharingDialog } from "@/components/ui/sharing-dialog"

interface ExportProgress {
  stage: 'preparing' | 'encoding' | 'saving' | 'complete' | 'error'
  progress: number
  message: string
  error?: string
}

interface ExportOptions {
  saveToLibrary: boolean
  downloadFile: boolean
  copyToClipboard: boolean
}

interface ExportPanelProps {
  gifBlob?: Blob
  settings?: Partial<GifSettings>
  onExport?: (metadata: Partial<GifData>, options: ExportOptions) => Promise<void>
  className?: string
  disabled?: boolean
}

interface FileSizePreviewProps {
  gifBlob?: Blob
  settings?: Partial<GifSettings>
  className?: string
}

const FileSizePreview: React.FC<FileSizePreviewProps> = ({
  gifBlob,
  settings,
  className
}) => {
  const [estimatedSize, setEstimatedSize] = React.useState<number | null>(null)
  const [actualSize, setActualSize] = React.useState<number | null>(null)

  // Calculate actual file size from blob
  React.useEffect(() => {
    if (gifBlob) {
      setActualSize(gifBlob.size)
    } else {
      setActualSize(null)
    }
  }, [gifBlob])

  // Estimate file size based on settings
  React.useEffect(() => {
    if (settings) {
      const frameRate = settings.frameRate || 15
      const quality = settings.quality || 'medium'
      const duration = settings.endTime && settings.startTime 
        ? settings.endTime - settings.startTime 
        : 3

      // Rough estimation based on common GIF parameters
      const qualityMultiplier = quality === 'high' ? 1.5 : quality === 'low' ? 0.6 : 1
      const estimated = Math.round(frameRate * duration * qualityMultiplier * 50 * 1024) // ~50KB per frame as baseline

      setEstimatedSize(estimated)
    }
  }, [settings])

  const formatFileSize = React.useCallback((bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }, [])

  const getSizeStatus = React.useCallback((size: number) => {
    if (size < 1024 * 1024) return { status: 'good', color: 'text-green-600' } // < 1MB
    if (size < 5 * 1024 * 1024) return { status: 'okay', color: 'text-yellow-600' } // < 5MB
    return { status: 'large', color: 'text-red-600' } // >= 5MB
  }, [])

  const currentSize = actualSize || estimatedSize
  const sizeInfo = currentSize ? getSizeStatus(currentSize) : null

  return (
    <div className={cn("space-y-3", className)}>
      <h4 className="text-sm font-medium text-muted-foreground">File Size Preview</h4>
      
      <div className="p-3 bg-muted/30 rounded-lg space-y-2">
        {currentSize ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm">
                {actualSize ? 'Current Size:' : 'Estimated Size:'}
              </span>
              <span className={cn("font-medium", sizeInfo?.color)}>
                {formatFileSize(currentSize)}
              </span>
            </div>
            
            {sizeInfo && (
              <div className="text-xs text-muted-foreground">
                {sizeInfo.status === 'good' && '✓ Good size for sharing'}
                {sizeInfo.status === 'okay' && '⚠ Moderate size, may load slowly'}
                {sizeInfo.status === 'large' && '⚠ Large file, consider reducing quality or duration'}
              </div>
            )}

            {/* Size breakdown */}
            {settings && (
              <div className="pt-2 border-t space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Frame Rate:</span>
                  <span>{settings.frameRate || 15} fps</span>
                </div>
                <div className="flex justify-between">
                  <span>Quality:</span>
                  <span className="capitalize">{settings.quality || 'medium'}</span>
                </div>
                {settings.endTime && settings.startTime && (
                  <div className="flex justify-between">
                    <span>Duration:</span>
                    <span>{(settings.endTime - settings.startTime).toFixed(1)}s</span>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="text-sm text-muted-foreground">
            No preview available
          </div>
        )}
      </div>
    </div>
  )
}

interface ProgressDisplayProps {
  progress: ExportProgress
  className?: string
}

const ProgressDisplay: React.FC<ProgressDisplayProps> = ({
  progress,
  className
}) => {
  const getStageInfo = React.useCallback((stage: ExportProgress['stage']) => {
    switch (stage) {
      case 'preparing':
        return { label: 'Preparing Export', icon: '⚙️' }
      case 'encoding':
        return { label: 'Encoding GIF', icon: '🎬' }
      case 'saving':
        return { label: 'Saving', icon: '💾' }
      case 'complete':
        return { label: 'Complete', icon: '✅' }
      case 'error':
        return { label: 'Error', icon: '❌' }
      default:
        return { label: 'Processing', icon: '⏳' }
    }
  }, [])

  const stageInfo = getStageInfo(progress.stage)

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <span className="text-lg">{stageInfo.icon}</span>
        <span className="font-medium">{stageInfo.label}</span>
        {progress.stage !== 'complete' && progress.stage !== 'error' && (
          <span className="text-sm text-muted-foreground">
            {Math.round(progress.progress)}%
          </span>
        )}
      </div>

      {progress.stage !== 'complete' && progress.stage !== 'error' && (
        <Progress value={progress.progress} className="w-full" />
      )}

      <div className="text-sm text-muted-foreground">
        {progress.message}
      </div>

      {progress.error && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
          {progress.error}
        </div>
      )}
    </div>
  )
}

export const ExportPanel: React.FC<ExportPanelProps> = ({
  gifBlob,
  settings,
  onExport,
  className,
  disabled = false
}) => {
  const [title, setTitle] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [filename, setFilename] = React.useState("")
  const [tags, setTags] = React.useState<string[]>([])
  const [exportOptions, setExportOptions] = React.useState<ExportOptions>({
    saveToLibrary: true,
    downloadFile: false,
    copyToClipboard: false
  })
  const [exportProgress, setExportProgress] = React.useState<ExportProgress | null>(null)
  const [isExporting, setIsExporting] = React.useState(false)
  const [clipboardSupported, setClipboardSupported] = React.useState(false)
  const [sharingDialogOpen, setSharingDialogOpen] = React.useState(false)

  // Check clipboard support on component mount
  React.useEffect(() => {
    const checkClipboardSupport = async () => {
      await clipboardManager.initialize()
      const capabilities = clipboardManager.getCapabilities()
      setClipboardSupported(Boolean(capabilities?.supportsNativeAPI && capabilities?.supportsImages))
    }
    checkClipboardSupport()
  }, [])

  const canExport = React.useMemo(() => {
    return !isExporting && 
           !disabled && 
           title.trim().length >= 3 && 
           filename.trim().length > 0 && 
           (exportOptions.saveToLibrary || exportOptions.downloadFile || exportOptions.copyToClipboard)
  }, [isExporting, disabled, title, filename, exportOptions])

  const handleExport = React.useCallback(async () => {
    if (!canExport || !onExport) return

    setIsExporting(true)
    setExportProgress({
      stage: 'preparing',
      progress: 0,
      message: 'Preparing export...'
    })

    try {
      const metadata: Partial<GifData> = {
        title: title.trim(),
        description: description.trim() || undefined,
        tags: tags.filter(tag => tag.trim().length > 0)
      }

      // Simulate progress stages
      setExportProgress({
        stage: 'encoding',
        progress: 25,
        message: 'Processing GIF data...'
      })

      await new Promise(resolve => setTimeout(resolve, 500)) // Simulate work

      setExportProgress({
        stage: 'saving',
        progress: 50,
        message: 'Saving to selected destinations...'
      })

      // Handle clipboard operation first if requested
      if (exportOptions.copyToClipboard && gifBlob) {
        setExportProgress({
          stage: 'saving',
          progress: 60,
          message: 'Copying GIF to clipboard...'
        })

        const clipboardResult = await clipboardManager.copyGif(gifBlob, {
          title: metadata.title,
          filename: filename.trim(),
          fallbackToDownload: true,
          userActivated: true
        })

        if (!clipboardResult.success) {
          // Don't block export process - just show warning to user
          console.warn('Clipboard operation failed:', clipboardResult.error)
        }
      }

      setExportProgress({
        stage: 'saving',
        progress: 75,
        message: 'Completing export operations...'
      })

      await onExport(metadata, exportOptions)

      setExportProgress({
        stage: 'complete',
        progress: 100,
        message: 'Export completed successfully!'
      })

      // Clear progress after a delay
      setTimeout(() => {
        setExportProgress(null)
        setIsExporting(false)
      }, 2000)

    } catch (error) {
      setExportProgress({
        stage: 'error',
        progress: 0,
        message: 'Export failed',
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      })
      
      setTimeout(() => {
        setExportProgress(null)
        setIsExporting(false)
      }, 3000)
    }
  }, [canExport, onExport, title, description, tags, exportOptions])

  const handleOptionChange = React.useCallback((option: keyof ExportOptions, value: boolean) => {
    setExportOptions(prev => ({ ...prev, [option]: value }))
  }, [])

  const hasSelectedOptions = Object.values(exportOptions).some(Boolean)

  return (
    <div className={cn("h-full", className)}>
      <ResponsiveContainer direction="row" className="h-full">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col">
          <EditorSection 
            title="Export Options" 
            description="Configure metadata and export settings for your GIF"
            className="flex-1 flex flex-col"
          >
            {exportProgress ? (
              <div className="flex-1 flex items-center justify-center">
                <ProgressDisplay progress={exportProgress} className="w-full max-w-md" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Export Options */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Save To</h4>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={exportOptions.saveToLibrary}
                        onChange={(e) => handleOptionChange('saveToLibrary', e.target.checked)}
                        disabled={disabled}
                        className="rounded"
                      />
                      <span className="text-sm">💾 Save to Library</span>
                      <span className="text-xs text-muted-foreground">(Recommended)</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={exportOptions.downloadFile}
                        onChange={(e) => handleOptionChange('downloadFile', e.target.checked)}
                        disabled={disabled}
                        className="rounded"
                      />
                      <span className="text-sm">⬇️ Download File</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={exportOptions.copyToClipboard}
                        onChange={(e) => handleOptionChange('copyToClipboard', e.target.checked)}
                        disabled={disabled || !clipboardSupported}
                        className="rounded"
                      />
                      <span className={cn("text-sm", !clipboardSupported && "text-muted-foreground")}>
                        📋 Copy to Clipboard
                      </span>
                      {!clipboardSupported && (
                        <span className="text-xs text-muted-foreground">
                          (Not supported)
                        </span>
                      )}
                    </label>
                  </div>
                  {!hasSelectedOptions && (
                    <p className="text-xs text-destructive">Please select at least one export option</p>
                  )}
                </div>

                {/* File Size Preview */}
                <FileSizePreview
                  gifBlob={gifBlob}
                  settings={settings}
                />
              </div>
            )}

            {/* Export and Share Buttons */}
            <div className="pt-6 border-t space-y-3">
              <Button
                onClick={handleExport}
                disabled={!canExport}
                className="w-full"
                size="lg"
              >
                {isExporting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                    Exporting...
                  </>
                ) : (
                  <>
                    🚀 Export GIF
                  </>
                )}
              </Button>
              
              {/* Share Button - available even before export */}
              {gifBlob && title.trim().length >= 3 && (
                <Button
                  variant="outline"
                  onClick={() => setSharingDialogOpen(true)}
                  disabled={isExporting}
                  className="w-full"
                  size="lg"
                >
                  📤 Share GIF
                </Button>
              )}
              
              {!canExport && !isExporting && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Complete metadata and select export options to enable export
                </p>
              )}
            </div>
          </EditorSection>
        </div>

        {/* Metadata Sidebar */}
        <div className="w-80 border-l bg-background">
          <div className="p-6 h-full overflow-y-auto">
            <MetadataForm
              title={title}
              description={description}
              filename={filename}
              tags={tags}
              onTitleChange={setTitle}
              onDescriptionChange={setDescription}
              onFilenameChange={setFilename}
              onTagsChange={setTags}
              disabled={disabled || isExporting}
            />
          </div>
        </div>
      </ResponsiveContainer>
      
      {/* Sharing Dialog */}
      <SharingDialog
        open={sharingDialogOpen}
        onOpenChange={setSharingDialogOpen}
        gifBlob={gifBlob}
        metadata={{
          title: title.trim(),
          description: description.trim() || undefined,
          tags: tags.filter(tag => tag.trim().length > 0)
        }}
      />
    </div>
  )
}

// Demo component with sample data
interface ExportPanelDemoProps {
  className?: string
  disabled?: boolean
}

export const ExportPanelDemo: React.FC<ExportPanelDemoProps> = ({
  className,
  disabled = false
}) => {
  // Create a mock blob for demonstration
  const [mockBlob, setMockBlob] = React.useState<Blob | null>(null)

  React.useEffect(() => {
    // Create a simple mock blob
    const blob = new Blob(['mock gif data'], { type: 'image/gif' })
    Object.defineProperty(blob, 'size', { value: 1024 * 500 }) // 500KB mock size
    setMockBlob(blob)
  }, [])

  const mockSettings: Partial<GifSettings> = {
    frameRate: 20,
    quality: 'medium',
    startTime: 0,
    endTime: 3.5,
    brightness: 1.2,
    contrast: 1.1,
    speed: 1
  }

  const handleExport = React.useCallback(async (metadata: Partial<GifData>, options: ExportOptions) => {
    console.log('Exporting with metadata:', metadata)
    console.log('Export options:', options)
    
    // Simulate export process
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    if (options.downloadFile) {
      console.log('Would download file with name:', `${metadata.title?.replace(/\s+/g, '-').toLowerCase()}.gif`)
    }
    
    if (options.copyToClipboard) {
      console.log('Would copy to clipboard')
    }
    
    if (options.saveToLibrary) {
      console.log('Would save to library')
    }
  }, [])

  return (
    <ExportPanel
      gifBlob={mockBlob || undefined}
      settings={mockSettings}
      onExport={handleExport}
      className={className}
      disabled={disabled}
    />
  )
}