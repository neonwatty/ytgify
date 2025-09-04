/**
 * Keyboard Shortcut Configuration Component
 * 
 * Provides a UI for users to customize keyboard shortcuts.
 * Includes validation, conflict detection, and real-time preview.
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  KeyboardShortcutManager, 
  ShortcutConfig as ShortcutConfigType, 
  KeyboardShortcut, 
  formatShortcut, 
  parseShortcutString,
  DEFAULT_SHORTCUTS 
} from '@/utils/keyboard-shortcuts';

interface ShortcutConfigProps {
  className?: string;
}

interface ShortcutEditState {
  action: keyof ShortcutConfigType | null;
  isRecording: boolean;
  currentValue: string;
  error: string | null;
}

const SHORTCUT_DESCRIPTIONS: Record<keyof ShortcutConfigType, { title: string; description: string; category: string }> = {
  preview: {
    title: 'Toggle Preview',
    description: 'Play/pause preview of the selected video segment',
    category: 'Playback'
  },
  save: {
    title: 'Save GIF',
    description: 'Save the current GIF with selected settings',
    category: 'Actions'
  },
  cancel: {
    title: 'Cancel Operation',
    description: 'Cancel the current operation and close overlay',
    category: 'Actions'
  },
  activateGifMode: {
    title: 'Activate GIF Mode',
    description: 'Open the GIF creation interface on YouTube',
    category: 'Navigation'
  },
  openLibrary: {
    title: 'Open GIF Library',
    description: 'Open your saved GIF collection',
    category: 'Navigation'
  },
  selectAll: {
    title: 'Select Entire Video',
    description: 'Select the entire video duration for GIF creation',
    category: 'Selection'
  },
  resetSelection: {
    title: 'Reset Selection',
    description: 'Reset the timeline selection to default',
    category: 'Selection'
  }
};

const CATEGORY_ORDER = ['Playback', 'Actions', 'Navigation', 'Selection'];

export const ShortcutConfig: React.FC<ShortcutConfigProps> = ({ className }) => {
  const [shortcuts, setShortcuts] = useState<ShortcutConfigType>(DEFAULT_SHORTCUTS);
  const [editState, setEditState] = useState<ShortcutEditState>({
    action: null,
    isRecording: false,
    currentValue: '',
    error: null
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [manager] = useState(() => new KeyboardShortcutManager('popup'));

  // Load shortcuts on mount
  useEffect(() => {
    const loadShortcuts = async () => {
      try {
        await manager.initialize();
        const config = manager.getConfig();
        setShortcuts(config);
      } catch (error) {
        console.error('Failed to load shortcuts:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadShortcuts();

    return () => {
      manager.destroy();
    };
  }, [manager]);

  // Group shortcuts by category
  const shortcutsByCategory = React.useMemo(() => {
    const grouped: Record<string, Array<{ action: keyof ShortcutConfigType; config: typeof SHORTCUT_DESCRIPTIONS[keyof ShortcutConfigType] }>> = {};
    
    Object.entries(SHORTCUT_DESCRIPTIONS).forEach(([action, config]) => {
      if (!grouped[config.category]) {
        grouped[config.category] = [];
      }
      grouped[config.category].push({ action: action as keyof ShortcutConfigType, config });
    });
    
    return grouped;
  }, []);

  const handleStartEdit = (action: keyof ShortcutConfigType) => {
    const shortcut = shortcuts[action];
    setEditState({
      action,
      isRecording: false,
      currentValue: formatShortcut(shortcut),
      error: null
    });
  };

  const handleCancelEdit = () => {
    setEditState({
      action: null,
      isRecording: false,
      currentValue: '',
      error: null
    });
  };

  const handleStartRecording = () => {
    setEditState(prev => ({
      ...prev,
      isRecording: true,
      currentValue: 'Press any key combination...',
      error: null
    }));

    // Add temporary event listener for recording
    const recordingListener = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      // Ignore modifier-only keys
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) {
        return;
      }

      const recordedShortcut: KeyboardShortcut = {
        key: event.code || event.key,
        modifiers: {
          ctrl: event.ctrlKey || undefined,
          alt: event.altKey || undefined,
          shift: event.shiftKey || undefined,
          meta: event.metaKey || undefined
        },
        description: '', // Will be filled later
        action: '' // Will be filled later
      };

      // Clean up empty modifiers
      if (recordedShortcut.modifiers && Object.values(recordedShortcut.modifiers).every(v => !v)) {
        recordedShortcut.modifiers = undefined;
      }

      const formattedShortcut = formatShortcut(recordedShortcut);
      
      setEditState(prev => ({
        ...prev,
        isRecording: false,
        currentValue: formattedShortcut,
        error: null
      }));

      document.removeEventListener('keydown', recordingListener, true);
    };

    document.addEventListener('keydown', recordingListener, true);

    // Auto-cleanup after 10 seconds
    setTimeout(() => {
      document.removeEventListener('keydown', recordingListener, true);
      setEditState(prev => prev.isRecording ? {
        ...prev,
        isRecording: false,
        currentValue: formatShortcut(shortcuts[prev.action!]),
        error: 'Recording timed out'
      } : prev);
    }, 10000);
  };

  const handleSaveShortcut = async () => {
    if (!editState.action) return;

    try {
      const parsed = parseShortcutString(editState.currentValue);
      
      if (!parsed.key) {
        setEditState(prev => ({ ...prev, error: 'Invalid shortcut format' }));
        return;
      }

      const newShortcut: KeyboardShortcut = {
        key: parsed.key,
        modifiers: parsed.modifiers,
        description: SHORTCUT_DESCRIPTIONS[editState.action].description,
        action: editState.action
      };

      // Update local state
      const newShortcuts = { ...shortcuts, [editState.action]: newShortcut };
      setShortcuts(newShortcuts);

      // Save to manager
      await manager.updateShortcut(editState.action, newShortcut);
      
      handleCancelEdit();
    } catch (error) {
      setEditState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to save shortcut' 
      }));
    }
  };

  const handleResetAll = async () => {
    if (!confirm('Are you sure you want to reset all shortcuts to their defaults?')) {
      return;
    }

    setIsSaving(true);
    try {
      await manager.resetToDefaults();
      const config = manager.getConfig();
      setShortcuts(config);
    } catch (error) {
      console.error('Failed to reset shortcuts:', error);
      alert('Failed to reset shortcuts. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEditState(prev => ({
      ...prev,
      currentValue: event.target.value,
      error: null
    }));
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-8 ${className}`}>
        <div className="text-muted-foreground">Loading shortcuts...</div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
          <p className="text-sm text-muted-foreground">
            Customize keyboard shortcuts for quick access to GIF creation features
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={handleResetAll}
          disabled={isSaving}
        >
          Reset All
        </Button>
      </div>

      {CATEGORY_ORDER.map(category => {
        const categoryShortcuts = shortcutsByCategory[category] || [];
        if (categoryShortcuts.length === 0) return null;

        return (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="text-base">{category}</CardTitle>
              <CardDescription>
                {category === 'Playback' && 'Control video playback and preview'}
                {category === 'Actions' && 'Quick actions for GIF creation'}
                {category === 'Navigation' && 'Navigate between different views'}
                {category === 'Selection' && 'Manage timeline selection'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {categoryShortcuts.map(({ action, config }) => (
                  <div key={action} className="flex items-center justify-between py-2">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{config.title}</div>
                      <div className="text-xs text-muted-foreground">{config.description}</div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {editState.action === action ? (
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col gap-1">
                            <input
                              type="text"
                              value={editState.currentValue}
                              onChange={handleInputChange}
                              className="px-2 py-1 border rounded text-sm w-40"
                              placeholder="e.g., Ctrl + S"
                              disabled={editState.isRecording}
                            />
                            {editState.error && (
                              <div className="text-xs text-destructive">{editState.error}</div>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={handleStartRecording}
                            disabled={editState.isRecording}
                          >
                            {editState.isRecording ? 'Recording...' : 'Record'}
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleSaveShortcut}
                            disabled={editState.isRecording}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleCancelEdit}
                            disabled={editState.isRecording}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <code className="px-2 py-1 bg-muted rounded text-sm font-mono">
                            {formatShortcut(shortcuts[action])}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleStartEdit(action)}
                          >
                            Edit
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Alert>
        <AlertDescription>
          <strong>Note:</strong> Some shortcuts are automatically disabled when you&apos;re typing in text fields.
          Shortcuts with modifier keys (Ctrl, Alt, Shift, Cmd) are recommended to avoid conflicts with YouTube&apos;s native shortcuts.
        </AlertDescription>
      </Alert>
    </div>
  );
};