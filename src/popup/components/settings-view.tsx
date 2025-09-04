import React from 'react';
import { Button } from '@/components/ui/button';
import { preferencesStorage, type UserPreferences, type PopupGifSettings } from '@/lib/storage';
import { ShortcutConfig } from '@/settings/shortcut-config';

const SettingsView: React.FC = () => {
  const [preferences, setPreferences] = React.useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);

  // Load preferences on mount
  React.useEffect(() => {
    const loadPreferences = async () => {
      try {
        const prefs = await preferencesStorage.get();
        setPreferences(prefs);
      } catch (error) {
        console.error('Failed to load preferences:', error);
        // Load default preferences from storage
        const defaultPrefs = await preferencesStorage.get();
        setPreferences(defaultPrefs);
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, []);

  const savePreferences = async (newPreferences: UserPreferences) => {
    setIsSaving(true);
    try {
      await preferencesStorage.save(newPreferences);
      setPreferences(newPreferences);
    } catch (error) {
      console.error('Failed to save preferences:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const updateGifSettings = (settings: Partial<PopupGifSettings>) => {
    if (!preferences) return;
    
    const newPreferences = {
      ...preferences,
      defaultGifSettings: {
        ...preferences.defaultGifSettings,
        ...settings
      }
    };
    
    savePreferences(newPreferences);
  };

  const updateGeneralSettings = (settings: Partial<Omit<UserPreferences, 'defaultGifSettings'>>) => {
    if (!preferences) return;
    
    const newPreferences = {
      ...preferences,
      ...settings
    };
    
    savePreferences(newPreferences);
  };

  const handleExportSettings = () => {
    if (!preferences) return;
    
    const dataStr = JSON.stringify(preferences, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'youtube-gif-maker-settings.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportSettings = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedSettings = JSON.parse(e.target?.result as string);
          savePreferences(importedSettings);
        } catch (error) {
          console.error('Failed to import settings:', error);
          alert('Invalid settings file. Please check the file and try again.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const resetToDefaults = async () => {
    if (!confirm('Are you sure you want to reset all settings to defaults?')) return;
    
    // Get fresh default preferences from storage
    const defaultPrefs = await preferencesStorage.get();
    await savePreferences(defaultPrefs);
  };

  const openExtensionOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  if (isLoading) {
    return (
      <div className="p-4 flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm text-red-600">Failed to load settings.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 max-h-96 overflow-y-auto">
      {/* GIF Quality Settings */}
      <div className="space-y-3">
        <h3 className="font-medium text-gray-900 text-sm">Default GIF Settings</h3>
        
        <div className="space-y-3">
          {/* Quality */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-700">Quality</label>
            <select
              value={preferences.defaultGifSettings.quality}
              onChange={(e) => updateGifSettings({ quality: e.target.value as 'low' | 'medium' | 'high' })}
              className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isSaving}
            >
              <option value="low">Low (Smaller file)</option>
              <option value="medium">Medium (Balanced)</option>
              <option value="high">High (Better quality)</option>
            </select>
          </div>

          {/* Frame Rate */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-700">Frame Rate</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="10"
                max="30"
                step="1"
                value={preferences.defaultGifSettings.frameRate}
                onChange={(e) => updateGifSettings({ frameRate: parseInt(e.target.value) })}
                className="w-16"
                disabled={isSaving}
              />
              <span className="text-sm text-gray-600 w-8">{preferences.defaultGifSettings.frameRate}</span>
            </div>
          </div>

          {/* Resolution */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-700">Resolution</label>
            <select
              value={`${preferences.defaultGifSettings.width}x${preferences.defaultGifSettings.height}`}
              onChange={(e) => {
                const [width, height] = e.target.value.split('x').map(Number);
                updateGifSettings({ width, height });
              }}
              className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isSaving}
            >
              <option value="320x180">320×180 (Small)</option>
              <option value="480x270">480×270 (Medium)</option>
              <option value="640x360">640×360 (Large)</option>
              <option value="854x480">854×480 (HD)</option>
            </select>
          </div>

          {/* Loop */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-700">Loop GIFs</label>
            <button
              type="button"
              onClick={() => updateGifSettings({ loop: !preferences.defaultGifSettings.loop })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                preferences.defaultGifSettings.loop ? 'bg-blue-600' : 'bg-gray-200'
              }`}
              disabled={isSaving}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  preferences.defaultGifSettings.loop ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* General Settings */}
      <div className="space-y-3 border-t border-gray-200 pt-4">
        <h3 className="font-medium text-gray-900 text-sm">General Settings</h3>
        
        <div className="space-y-3">
          {/* Auto Save */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-700">Auto-save GIFs</label>
            <button
              type="button"
              onClick={() => updateGeneralSettings({ autoSave: !preferences.autoSave })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                preferences.autoSave ? 'bg-blue-600' : 'bg-gray-200'
              }`}
              disabled={isSaving}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  preferences.autoSave ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Notifications */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-700">Show notifications</label>
            <button
              type="button"
              onClick={() => updateGeneralSettings({ showNotifications: !preferences.showNotifications })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                preferences.showNotifications ? 'bg-blue-600' : 'bg-gray-200'
              }`}
              disabled={isSaving}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  preferences.showNotifications ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Storage Limit */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-700">Storage Limit</label>
            <select
              value={preferences.maxStorageSize}
              onChange={(e) => updateGeneralSettings({ maxStorageSize: parseInt(e.target.value) })}
              className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isSaving}
            >
              <option value={50 * 1024 * 1024}>50 MB</option>
              <option value={100 * 1024 * 1024}>100 MB</option>
              <option value={200 * 1024 * 1024}>200 MB</option>
              <option value={500 * 1024 * 1024}>500 MB</option>
            </select>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      <div className="space-y-3 border-t border-gray-200 pt-4">
        <h3 className="font-medium text-gray-900 text-sm">Keyboard Shortcuts</h3>
        
        <ShortcutConfig className="space-y-2" />
      </div>

      {/* Quick Actions */}
      <div className="space-y-3 border-t border-gray-200 pt-4">
        <h3 className="font-medium text-gray-900 text-sm">Quick Actions</h3>
        
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={openExtensionOptions}
            className="text-xs"
          >
            📋 Options
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => chrome.tabs.create({ url: 'https://github.com/user/youtube-gif-maker' })}
            className="text-xs"
          >
            🐛 Report Bug
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportSettings}
            className="text-xs"
          >
            📤 Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleImportSettings}
            className="text-xs"
          >
            📥 Import
          </Button>
        </div>
      </div>

      {/* Reset */}
      <div className="border-t border-gray-200 pt-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={resetToDefaults}
          disabled={isSaving}
          className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          Reset to Defaults
        </Button>
      </div>

      {/* Loading overlay */}
      {isSaving && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
            Saving...
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsView;