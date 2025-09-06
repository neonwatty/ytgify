import React from 'react';
import { Button } from '@/components/ui/button';
import { preferencesStorage, type UserPreferences, type PopupGifSettings } from '@/lib/storage';
import { ShortcutConfig } from '@/settings/shortcut-config';

const SettingsView: React.FC = () => {
  const [preferences, setPreferences] = React.useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [expandedSection, setExpandedSection] = React.useState<string>('gif');

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

  const resetToDefaults = async () => {
    if (!confirm('Reset all settings to defaults?')) return;
    
    // Get fresh default preferences from storage
    const defaultPrefs = await preferencesStorage.get();
    await savePreferences(defaultPrefs);
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? '' : section);
  };

  if (isLoading) {
    return (
      <div className="p-2 flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-xs text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="p-2 text-center">
        <p className="text-xs text-red-600">Failed to load settings.</p>
      </div>
    );
  }

  const SectionHeader = ({ id, title, icon }: { id: string; title: string; icon: string }) => (
    <button
      onClick={() => toggleSection(id)}
      className="w-full flex items-center justify-between p-2 bg-gray-50 hover:bg-gray-100 rounded transition-colors"
    >
      <div className="flex items-center gap-2 text-xs font-medium text-gray-700">
        <span>{icon}</span>
        <span>{title}</span>
      </div>
      <svg 
        className={`w-3 h-3 text-gray-500 transition-transform ${expandedSection === id ? 'rotate-180' : ''}`}
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );

  return (
    <div className="p-2 h-full flex flex-col">
      <div className="flex-1 overflow-y-auto space-y-2">
        {/* GIF Settings Section */}
        <div className="border border-gray-200 rounded overflow-hidden">
          <SectionHeader id="gif" title="GIF Settings" icon="🎬" />
          {expandedSection === 'gif' && (
            <div className="p-2 space-y-2 bg-white">
              {/* Quality */}
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-700">Quality</label>
                <select
                  value={preferences.defaultGifSettings.quality}
                  onChange={(e) => updateGifSettings({ quality: e.target.value as 'low' | 'medium' | 'high' })}
                  className="text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={isSaving}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              {/* Frame Rate */}
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-700">FPS</label>
                <div className="flex items-center gap-1">
                  <input
                    type="range"
                    min="10"
                    max="30"
                    step="5"
                    value={preferences.defaultGifSettings.frameRate}
                    onChange={(e) => updateGifSettings({ frameRate: parseInt(e.target.value) })}
                    className="w-12"
                    disabled={isSaving}
                  />
                  <span className="text-xs text-gray-600 w-6">{preferences.defaultGifSettings.frameRate}</span>
                </div>
              </div>

              {/* Resolution */}
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-700">Size</label>
                <select
                  value={`${preferences.defaultGifSettings.width}x${preferences.defaultGifSettings.height}`}
                  onChange={(e) => {
                    const [width, height] = e.target.value.split('x').map(Number);
                    updateGifSettings({ width, height });
                  }}
                  className="text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={isSaving}
                >
                  <option value="320x180">320×180</option>
                  <option value="480x270">480×270</option>
                  <option value="640x360">640×360</option>
                </select>
              </div>

              {/* Loop */}
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-700">Loop</label>
                <button
                  type="button"
                  onClick={() => updateGifSettings({ loop: !preferences.defaultGifSettings.loop })}
                  className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${
                    preferences.defaultGifSettings.loop ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                  disabled={isSaving}
                >
                  <span
                    className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                      preferences.defaultGifSettings.loop ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* General Settings Section */}
        <div className="border border-gray-200 rounded overflow-hidden">
          <SectionHeader id="general" title="General" icon="⚙️" />
          {expandedSection === 'general' && (
            <div className="p-2 space-y-2 bg-white">
              {/* Auto Save */}
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-700">Auto-save</label>
                <button
                  type="button"
                  onClick={() => updateGeneralSettings({ autoSave: !preferences.autoSave })}
                  className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${
                    preferences.autoSave ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                  disabled={isSaving}
                >
                  <span
                    className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                      preferences.autoSave ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Notifications */}
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-700">Notifications</label>
                <button
                  type="button"
                  onClick={() => updateGeneralSettings({ showNotifications: !preferences.showNotifications })}
                  className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${
                    preferences.showNotifications ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                  disabled={isSaving}
                >
                  <span
                    className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                      preferences.showNotifications ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Storage Limit */}
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-700">Storage</label>
                <select
                  value={preferences.maxStorageSize}
                  onChange={(e) => updateGeneralSettings({ maxStorageSize: parseInt(e.target.value) })}
                  className="text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={isSaving}
                >
                  <option value={50 * 1024 * 1024}>50 MB</option>
                  <option value={100 * 1024 * 1024}>100 MB</option>
                  <option value={200 * 1024 * 1024}>200 MB</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Shortcuts Section */}
        <div className="border border-gray-200 rounded overflow-hidden">
          <SectionHeader id="shortcuts" title="Keyboard Shortcuts" icon="⌨️" />
          {expandedSection === 'shortcuts' && (
            <div className="p-2 bg-white">
              <ShortcutConfig className="space-y-1 text-xs" />
            </div>
          )}
        </div>

        {/* Advanced Section */}
        <div className="border border-gray-200 rounded overflow-hidden">
          <SectionHeader id="advanced" title="Advanced" icon="🔧" />
          {expandedSection === 'advanced' && (
            <div className="p-2 space-y-2 bg-white">
              <Button
                variant="outline"
                size="sm"
                onClick={() => chrome.runtime.openOptionsPage()}
                className="w-full text-xs"
              >
                Open Full Settings
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetToDefaults}
                disabled={isSaving}
                className="w-full text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                Reset to Defaults
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Loading overlay */}
      {isSaving && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-500"></div>
            Saving...
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsView;