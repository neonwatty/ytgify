import * as React from "react"
import { cn } from "@/lib/utils"
import { TextOverlay } from "@/types"
import { TextOverlayCanvas } from "./text-overlay"
import { TextControls } from "./text-controls"
import { ResponsiveContainer, EditorSection } from "../layout"

interface TextOverlayEditorProps {
  overlays: TextOverlay[]
  onUpdateOverlays: (overlays: TextOverlay[]) => void
  className?: string
  disabled?: boolean
  previewContent?: React.ReactNode
}

export const TextOverlayEditor: React.FC<TextOverlayEditorProps> = ({
  overlays = [],
  onUpdateOverlays,
  className,
  disabled = false,
  previewContent
}) => {
  const [selectedOverlayId, setSelectedOverlayId] = React.useState<string | null>(null)
  const [overlayCounter, setOverlayCounter] = React.useState(1)

  // Generate unique ID for new overlay
  const generateOverlayId = React.useCallback(() => {
    return `text-overlay-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }, [])

  // Add new text overlay
  const handleAddOverlay = React.useCallback(() => {
    const newOverlay: TextOverlay = {
      id: generateOverlayId(),
      text: `Text ${overlayCounter}`,
      position: { x: 50, y: 50 + (overlays.length * 40) },
      fontSize: 24,
      fontFamily: 'Arial, sans-serif',
      color: '#FFFFFF',
      animation: 'none'
    }

    const updatedOverlays = [...overlays, newOverlay]
    onUpdateOverlays(updatedOverlays)
    setSelectedOverlayId(newOverlay.id)
    setOverlayCounter(prev => prev + 1)
  }, [overlays, overlayCounter, generateOverlayId, onUpdateOverlays])

  // Update specific overlay
  const handleUpdateOverlay = React.useCallback((updatedOverlay: TextOverlay) => {
    const updatedOverlays = overlays.map(overlay =>
      overlay.id === updatedOverlay.id ? updatedOverlay : overlay
    )
    onUpdateOverlays(updatedOverlays)
  }, [overlays, onUpdateOverlays])

  // Delete overlay
  const handleDeleteOverlay = React.useCallback((overlayId: string) => {
    const updatedOverlays = overlays.filter(overlay => overlay.id !== overlayId)
    onUpdateOverlays(updatedOverlays)
    
    if (selectedOverlayId === overlayId) {
      setSelectedOverlayId(null)
    }
  }, [overlays, selectedOverlayId, onUpdateOverlays])

  // Select overlay
  const handleSelectOverlay = React.useCallback((overlayId: string | null) => {
    setSelectedOverlayId(overlayId)
  }, [])

  // Clear all overlays
  const handleClearAll = React.useCallback(() => {
    onUpdateOverlays([])
    setSelectedOverlayId(null)
  }, [onUpdateOverlays])

  // Duplicate selected overlay
  const handleDuplicateOverlay = React.useCallback(() => {
    const selectedOverlay = overlays.find(o => o.id === selectedOverlayId)
    if (!selectedOverlay) return

    const duplicatedOverlay: TextOverlay = {
      ...selectedOverlay,
      id: generateOverlayId(),
      text: `${selectedOverlay.text} Copy`,
      position: {
        x: selectedOverlay.position.x + 20,
        y: selectedOverlay.position.y + 20
      }
    }

    const updatedOverlays = [...overlays, duplicatedOverlay]
    onUpdateOverlays(updatedOverlays)
    setSelectedOverlayId(duplicatedOverlay.id)
  }, [overlays, selectedOverlayId, generateOverlayId, onUpdateOverlays])

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled) return

      // Ctrl/Cmd + D to duplicate
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault()
        handleDuplicateOverlay()
      }
      
      // Ctrl/Cmd + A to add new
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault()
        handleAddOverlay()
      }

      // Escape to deselect
      if (e.key === 'Escape') {
        setSelectedOverlayId(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [disabled, handleDuplicateOverlay, handleAddOverlay])

  const selectedOverlay = React.useMemo(
    () => overlays.find(overlay => overlay.id === selectedOverlayId),
    [overlays, selectedOverlayId]
  )

  return (
    <div className={cn("h-full", className)}>
      <ResponsiveContainer direction="row" className="h-full">
        {/* Canvas Area */}
        <div className="flex-1 flex flex-col">
          <EditorSection 
            title="Text Overlay Canvas" 
            description="Drag text overlays to position them"
            className="flex-1 flex flex-col"
          >
            <div className="flex-1 min-h-0">
              <TextOverlayCanvas
                overlays={overlays}
                onUpdateOverlay={handleUpdateOverlay}
                onSelectOverlay={handleSelectOverlay}
                onDeleteOverlay={handleDeleteOverlay}
                selectedOverlayId={selectedOverlayId}
                disabled={disabled}
                className="h-full"
              >
                {previewContent}
              </TextOverlayCanvas>
            </div>

            {/* Canvas Tools */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {overlays.length} {overlays.length === 1 ? 'overlay' : 'overlays'}
                </span>
                {selectedOverlay && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                    {selectedOverlay.text} selected
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {selectedOverlayId && (
                  <button
                    onClick={handleDuplicateOverlay}
                    disabled={disabled}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    title="Duplicate selected overlay (Ctrl+D)"
                  >
                    Duplicate
                  </button>
                )}
                
                {overlays.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    disabled={disabled}
                    className="text-sm text-destructive hover:text-destructive/80 transition-colors"
                    title="Clear all overlays"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>
          </EditorSection>
        </div>

        {/* Controls Sidebar */}
        <div className="w-80 border-l bg-background">
          <div className="p-6 h-full overflow-y-auto">
            <TextControls
              overlays={overlays}
              selectedOverlayId={selectedOverlayId}
              onUpdateOverlay={handleUpdateOverlay}
              onAddOverlay={handleAddOverlay}
              onDeleteOverlay={handleDeleteOverlay}
              onSelectOverlay={handleSelectOverlay}
              disabled={disabled}
            />
          </div>
        </div>
      </ResponsiveContainer>

      {/* Keyboard Shortcuts Help */}
      <div className="absolute bottom-4 left-4 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm p-2 rounded border">
        <div>Keyboard shortcuts:</div>
        <div>• Double-click text to edit</div>
        <div>• Delete/Backspace to remove</div>
        <div>• Ctrl+A to add new</div>
        <div>• Ctrl+D to duplicate</div>
        <div>• Escape to deselect</div>
      </div>
    </div>
  )
}

// Demo component that includes sample preview content
interface TextOverlayEditorDemoProps {
  className?: string
  disabled?: boolean
}

export const TextOverlayEditorDemo: React.FC<TextOverlayEditorDemoProps> = ({
  className,
  disabled = false
}) => {
  const [overlays, setOverlays] = React.useState<TextOverlay[]>([
    {
      id: 'demo-1',
      text: 'Sample Text',
      position: { x: 100, y: 100 },
      fontSize: 32,
      fontFamily: 'Arial, sans-serif',
      color: '#FFFFFF',
      animation: 'fade-in'
    },
    {
      id: 'demo-2', 
      text: 'Another Layer',
      position: { x: 150, y: 200 },
      fontSize: 24,
      fontFamily: 'Times New Roman, serif',
      color: '#FFD700',
      animation: 'none'
    }
  ])

  // Sample preview content (could be a video frame or image)
  const previewContent = (
    <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
      <div className="text-white/20 text-4xl font-bold">
        VIDEO PREVIEW
      </div>
    </div>
  )

  return (
    <TextOverlayEditor
      overlays={overlays}
      onUpdateOverlays={setOverlays}
      previewContent={previewContent}
      className={className}
      disabled={disabled}
    />
  )
}