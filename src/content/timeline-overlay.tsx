import React, { useState, useRef, useCallback, useEffect } from 'react';
import { TimelineSelection } from '@/types';
import { TimelineMarkers } from './timeline-markers';
import { QuickPresets } from './quick-presets';
import { KeyboardShortcutManager } from '@/utils/keyboard-shortcuts';

export interface TimelineOverlayProps {
  videoDuration: number;
  currentTime: number;
  onSelectionChange: (selection: TimelineSelection) => void;
  onClose: () => void;
  onCreateGif: () => void;
  onSeekTo?: (time: number) => void;
  onPreviewToggle?: () => void;
  isCreating?: boolean;
  isPreviewActive?: boolean;
  className?: string;
  processingStatus?: {
    stage: string;
    progress: number;
    message: string;
  };
}

interface TimelineOverlayState {
  isTheaterMode: boolean;
  isFullscreen: boolean;
  isCompact: boolean;
}

export const TimelineOverlay: React.FC<TimelineOverlayProps> = ({
  videoDuration,
  currentTime,
  onSelectionChange,
  onClose,
  onCreateGif,
  onSeekTo,
  onPreviewToggle: _onPreviewToggle,
  isCreating = false,
  isPreviewActive: _isPreviewActive,
  className = '',
  processingStatus
}) => {
  // Debug logging
  React.useEffect(() => {
    
  }, [isCreating, processingStatus]);
  // Initialize selection from current time forward
  const [selection, setSelection] = useState<TimelineSelection>(() => {
    const startTime = currentTime;
    const endTime = Math.min(videoDuration, currentTime + 5);
    return {
      startTime,
      endTime,
      duration: endTime - startTime
    };
  });

  const [playerState, setPlayerState] = useState<TimelineOverlayState>({
    isTheaterMode: false,
    isFullscreen: false,
    isCompact: false
  });

  const overlayRef = useRef<HTMLDivElement>(null);
  const [shortcutManager] = useState(() => new KeyboardShortcutManager('content'));

  // Detect player mode changes
  const detectPlayerState = useCallback(() => {
    const isTheaterMode = document.querySelector('body[theater]') !== null ||
                         document.querySelector('.ytp-big-mode') !== null;
    
    const doc = document as Document & {
      webkitFullscreenElement?: Element;
      mozFullScreenElement?: Element;
      msFullscreenElement?: Element;
    };
    
    const isFullscreen = document.fullscreenElement !== null ||
                        doc.webkitFullscreenElement !== undefined ||
                        doc.mozFullScreenElement !== undefined ||
                        doc.msFullscreenElement !== undefined;

    // Check for compact/mini player
    const player = document.querySelector('#movie_player');
    let isCompact = false;
    
    if (player) {
      const rect = player.getBoundingClientRect();
      isCompact = rect.width < 400 || rect.height < 300;
    }

    isCompact = isCompact || 
               document.querySelector('.ytp-miniplayer') !== null ||
               document.querySelector('.miniplayer-is-active') !== null;

    setPlayerState({
      isTheaterMode,
      isFullscreen,
      isCompact
    });
  }, []);

  // Update player state on mount and changes
  useEffect(() => {
    detectPlayerState();
    
    // Listen for fullscreen changes
    const handleFullscreenChange = () => detectPlayerState();
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    
    // Listen for theater mode changes
    const observer = new MutationObserver(() => detectPlayerState());
    observer.observe(document.body, { 
      attributes: true, 
      attributeFilter: ['theater', 'class'] 
    });

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      observer.disconnect();
    };
  }, [detectPlayerState]);

  // Handle selection updates
  const handleSelectionChange = useCallback((newSelection: TimelineSelection) => {
    setSelection(newSelection);
    onSelectionChange(newSelection);
  }, [onSelectionChange]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const initializeShortcuts = async () => {
      await shortcutManager.initialize();

      // Register shortcut handlers
      const cancelHandler = shortcutManager.registerHandler({
        action: 'cancel',
        handler: () => onClose(),
        priority: 10
      });

      const saveHandler = shortcutManager.registerHandler({
        action: 'save', 
        handler: () => {
          if (!isCreating) {
            onCreateGif();
          }
        },
        priority: 10,
        condition: () => !isCreating
      });

      const previewHandler = shortcutManager.registerHandler({
        action: 'preview',
        handler: () => {
          if (_onPreviewToggle) {
            _onPreviewToggle();
          }
        },
        priority: 10
      });

      return () => {
        cancelHandler();
        saveHandler();
        previewHandler();
        shortcutManager.destroy();
      };
    };

    initializeShortcuts();
  }, [shortcutManager, onClose, onCreateGif, _onPreviewToggle, isCreating]);

  // Build overlay classes based on player state
  const overlayClasses = [
    'ytgif-timeline-overlay',
    playerState.isTheaterMode && 'ytgif-timeline-theater',
    playerState.isFullscreen && 'ytgif-timeline-fullscreen',
    playerState.isCompact && 'ytgif-timeline-compact',
    className
  ].filter(Boolean).join(' ');

  return (
    <div
      ref={overlayRef}
      className={overlayClasses}
      data-theater={playerState.isTheaterMode ? 'true' : undefined}
      data-fullscreen={playerState.isFullscreen ? 'true' : undefined}
      data-compact={playerState.isCompact ? 'true' : undefined}
      data-gif-maker-shortcut-zone="true"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ytgif-timeline-title"
    >
      <div className="ytgif-timeline-container">
        <header className="ytgif-timeline-header">
          <h3 id="ytgif-timeline-title">Select GIF Segment</h3>
          <button
            className="ytgif-timeline-close"
            onClick={onClose}
            aria-label="Close timeline overlay"
            type="button"
          >
            ×
          </button>
        </header>

        <QuickPresets
          videoDuration={videoDuration}
          currentTime={currentTime}
          onPresetSelect={(selection, _presetInfo) => {
            handleSelectionChange(selection);
            // Optional: Could add some feedback about the preset selection
          }}
          disabled={isCreating}
        />

        <div className="ytgif-timeline-controls">
          <TimelineMarkers
            videoDuration={videoDuration}
            currentTime={currentTime}
            selection={selection}
            onSelectionChange={handleSelectionChange}
            onSeekTo={onSeekTo}
          />
          
          <div className="ytgif-timeline-info">
            <span className="ytgif-timeline-duration" aria-live="polite">
              Duration: {selection.duration.toFixed(1)}s
            </span>
            <span className="ytgif-timeline-range">
              {formatTime(selection.startTime)} - {formatTime(selection.endTime)}
            </span>
          </div>
        </div>

        {/* Progress Indicator */}
        {isCreating && processingStatus && (
          <div className="ytgif-progress-container">
            <div className="ytgif-progress-header">
              <span className="ytgif-progress-stage">{processingStatus.stage}</span>
              <span className="ytgif-progress-percentage">{Math.round(processingStatus.progress)}%</span>
            </div>
            <div className="ytgif-progress-bar-wrapper">
              <div 
                className="ytgif-progress-bar" 
                style={{ 
                  width: `${Math.min(100, Math.max(0, processingStatus.progress))}%`,
                  '--progress': `${Math.min(100, Math.max(0, processingStatus.progress))}%`
                } as React.CSSProperties}
                data-progress={processingStatus.progress}
              />
            </div>
            <div className="ytgif-progress-message">{processingStatus.message}</div>
          </div>
        )}

        <footer className="ytgif-timeline-actions">
          <button
            className={`ytgif-timeline-create ${isCreating ? 'loading' : ''}`}
            onClick={onCreateGif}
            disabled={isCreating || selection.duration < 0.5}
            type="button"
          >
            {isCreating && processingStatus 
              ? `${processingStatus.stage} (${Math.round(processingStatus.progress)}%)`
              : isCreating ? 'Creating...' : 'Create GIF'
            }
          </button>
          <button
            className="ytgif-timeline-cancel"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
        </footer>
      </div>
    </div>
  );
};

// Helper function to format time display
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  
  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }
  
  return `${secs}.${ms.toString().padStart(2, '0')}s`;
}