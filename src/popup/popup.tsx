import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  ExtensionMessage,
  GetVideoStateRequest,
  OpenEditorRequest 
} from '@/types';
import LibraryView from './components/library-view';
import SettingsView from './components/settings-view';

type PopupView = 'create' | 'library' | 'settings';

interface VideoState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  videoUrl: string;
  title: string;
}

const PopupApp: React.FC = () => {
  const [activeView, setActiveView] = React.useState<PopupView>('create');
  const [videoState, setVideoState] = React.useState<VideoState | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isYouTubePage, setIsYouTubePage] = React.useState(false);

  // Check if current tab is YouTube and get video state
  React.useEffect(() => {
    const checkCurrentTab = async () => {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const currentTab = tabs[0];
        
        if (!currentTab || !currentTab.url) return;
        
        const isYoutube = currentTab.url.includes('youtube.com');
        setIsYouTubePage(isYoutube);
        
        if (isYoutube && currentTab.id) {
          // Request video state from content script
          const message: GetVideoStateRequest = {
            type: 'GET_VIDEO_STATE'
          };
          
          try {
            const response = await chrome.tabs.sendMessage(currentTab.id, message);
            if (response && response.success && response.data) {
              setVideoState(response.data);
            }
          } catch (error) {
            // Content script might not be loaded yet
            console.log('Could not get video state:', error);
          }
        }
      } catch (error) {
        console.error('Error checking current tab:', error);
      }
    };

    checkCurrentTab();
  }, []);

  const handleActivateGifMode = async () => {
    if (!isYouTubePage) return;
    
    setIsLoading(true);
    
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      if (currentTab?.id) {
        // Send message to content script to activate GIF mode
        const message: ExtensionMessage = {
          type: 'SHOW_TIMELINE',
          data: {
            videoDuration: videoState?.duration || 0,
            currentTime: videoState?.currentTime || 0
          }
        };
        
        await chrome.tabs.sendMessage(currentTab.id, message);
        window.close();
      }
    } catch (error) {
      console.error('Failed to activate GIF mode:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenEditor = async () => {
    if (!isYouTubePage || !videoState) return;
    
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      if (currentTab?.id) {
        const message: OpenEditorRequest = {
          type: 'OPEN_EDITOR',
          data: {
            videoUrl: videoState.videoUrl,
            selection: {
              startTime: Math.max(0, videoState.currentTime - 5),
              endTime: Math.min(videoState.duration, videoState.currentTime + 5),
              duration: 10
            }
          }
        };
        
        await chrome.tabs.sendMessage(currentTab.id, message);
        window.close();
      }
    } catch (error) {
      console.error('Failed to open editor:', error);
    }
  };

  const NavigationTabs = () => (
    <div className="flex border-b border-gray-200">
      {([
        { id: 'create', label: 'Create', icon: '🎬' },
        { id: 'library', label: 'Library', icon: '📚' },
        { id: 'settings', label: 'Settings', icon: '⚙️' }
      ] as const).map(({ id, label, icon }) => (
        <button
          key={id}
          onClick={() => setActiveView(id)}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium transition-colors",
            activeView === id
              ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
          )}
        >
          <span className="text-lg">{icon}</span>
          {label}
        </button>
      ))}
    </div>
  );

  const CreateView = () => (
    <div className="p-4 space-y-4">
      <div className="text-center space-y-2">
        <h2 className="text-lg font-semibold text-gray-900">Create GIF</h2>
        <p className="text-sm text-gray-600">
          {isYouTubePage
            ? videoState
              ? `Ready to create GIF from: ${videoState.title}`
              : "Detecting video..."
            : "Navigate to a YouTube video to start creating GIFs"
          }
        </p>
      </div>

      {isYouTubePage ? (
        <div className="space-y-3">
          {videoState && (
            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>Current Time</span>
                <span>{Math.floor(videoState.currentTime)}s / {Math.floor(videoState.duration)}s</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${(videoState.currentTime / videoState.duration) * 100}%` }}
                />
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="youtube"
              onClick={handleActivateGifMode}
              disabled={isLoading || !videoState}
              className="w-full"
            >
              {isLoading ? "Loading..." : "Quick GIF"}
            </Button>
            <Button
              variant="outline"
              onClick={handleOpenEditor}
              disabled={!videoState}
              className="w-full"
            >
              Advanced
            </Button>
          </div>
          
          <p className="text-xs text-gray-500 text-center">
            Quick GIF creates a 4-second clip around current time.
            Advanced opens the timeline editor.
          </p>
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="text-4xl mb-4">📺</div>
          <p className="text-sm text-gray-500">
            Please navigate to a YouTube video page to use this extension.
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="w-80 bg-white shadow-lg rounded-lg overflow-hidden">
      <div className="bg-gradient-to-r from-red-500 to-red-600 text-white p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
            <span className="text-red-500 font-bold text-lg">G</span>
          </div>
          <div>
            <h1 className="font-semibold text-lg">YouTube GIF Maker</h1>
            <p className="text-red-100 text-xs">Create GIFs from any YouTube video</p>
          </div>
        </div>
      </div>

      <NavigationTabs />

      <div className="min-h-[300px]">
        {activeView === 'create' && <CreateView />}
        {activeView === 'library' && <LibraryView />}
        {activeView === 'settings' && <SettingsView />}
      </div>

      <div className="border-t border-gray-200 p-2 bg-gray-50">
        <p className="text-xs text-gray-500 text-center">
          v1.0.0 • Made with ❤️ for YouTube creators
        </p>
      </div>
    </div>
  );
};

export default PopupApp;