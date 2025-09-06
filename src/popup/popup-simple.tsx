import React from 'react';
import { Button } from '@/components/ui/button';
import { ExtensionMessage, ShowTimelineRequest } from '@/types';
import LibraryView from './components/library-view';
import SettingsView from './components/settings-view';

const SimplePopup: React.FC = () => {
  const [isYouTubePage, setIsYouTubePage] = React.useState(false);
  const [videoTitle, setVideoTitle] = React.useState<string>('');
  const [showLibrary, setShowLibrary] = React.useState(false);
  const [showSettings, setShowSettings] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  // Check if current tab is YouTube
  React.useEffect(() => {
    const checkCurrentTab = async () => {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const currentTab = tabs[0];
        
        if (!currentTab || !currentTab.url) return;
        
        const isYoutube = currentTab.url.includes('youtube.com/watch');
        setIsYouTubePage(isYoutube);
        
        if (isYoutube && currentTab.title) {
          // Extract video title from tab title (removes " - YouTube" suffix)
          const title = currentTab.title.replace(' - YouTube', '');
          setVideoTitle(title);
        }
      } catch (error) {
        console.error('Error checking current tab:', error);
      }
    };

    checkCurrentTab();
  }, []);

  const handleCreateGif = async () => {
    if (!isYouTubePage) {
      // Open YouTube in new tab
      chrome.tabs.create({ url: 'https://www.youtube.com' });
      window.close();
      return;
    }

    setIsLoading(true);
    
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      if (currentTab?.id) {
        // Send message to content script to show the overlay wizard
        const message: ShowTimelineRequest = {
          type: 'SHOW_TIMELINE',
          data: {
            videoDuration: 0, // Will be filled by content script
            currentTime: 0    // Will be filled by content script
          }
        };
        
        await chrome.tabs.sendMessage(currentTab.id, message);
        // Close popup after triggering overlay
        window.close();
      }
    } catch (error) {
      console.error('Failed to show overlay:', error);
      setIsLoading(false);
    }
  };

  // Show library view
  if (showLibrary) {
    return (
      <div className="w-full h-full bg-white flex flex-col" style={{ width: '360px', height: '400px' }}>
        <div className="bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setShowLibrary(false)}
            className="p-1 rounded hover:bg-white/20 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="font-semibold">GIF Library</h1>
          <div className="w-6"></div>
        </div>
        <div className="flex-1 overflow-hidden">
          <LibraryView />
        </div>
      </div>
    );
  }

  // Show settings view
  if (showSettings) {
    return (
      <div className="w-full h-full bg-white flex flex-col" style={{ width: '360px', height: '400px' }}>
        <div className="bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setShowSettings(false)}
            className="p-1 rounded hover:bg-white/20 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="font-semibold">Settings</h1>
          <div className="w-6"></div>
        </div>
        <div className="flex-1 overflow-hidden">
          <SettingsView />
        </div>
      </div>
    );
  }

  // Main minimal launcher view
  return (
    <div className="w-full h-full bg-gradient-to-br from-gray-50 to-white flex flex-col" style={{ width: '360px', height: '400px' }}>
      {/* Header */}
      <div className="bg-gradient-to-r from-red-500 to-red-600 text-white px-6 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-xl">G</span>
            </div>
            <div>
              <h1 className="font-bold text-lg">YouTube GIF Maker</h1>
              <p className="text-xs text-white/80">Create GIFs instantly</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        {isYouTubePage ? (
          <>
            {/* Video Detected */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm text-gray-600 font-medium">Video Ready</p>
              {videoTitle && (
                <p className="text-xs text-gray-500 mt-2 line-clamp-2 max-w-[280px] mx-auto">
                  {videoTitle}
                </p>
              )}
            </div>

            {/* Create GIF Button */}
            <Button
              onClick={handleCreateGif}
              disabled={isLoading}
              className="w-full max-w-[200px] h-12 text-base font-semibold bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg transform transition-all hover:scale-105"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  Loading...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Create GIF
                </span>
              )}
            </Button>
          </>
        ) : (
          <>
            {/* No Video */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm text-gray-600 font-medium mb-2">No Video Detected</p>
              <p className="text-xs text-gray-500">Navigate to a YouTube video to get started</p>
            </div>

            {/* Open YouTube Button */}
            <Button
              onClick={handleCreateGif}
              variant="outline"
              className="w-full max-w-[200px] h-12 text-base font-semibold border-2"
            >
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                </svg>
                Open YouTube
              </span>
            </Button>
          </>
        )}
      </div>

      {/* Footer with Quick Actions */}
      <div className="border-t border-gray-200 px-6 py-3">
        <div className="flex justify-center gap-6">
          <button
            onClick={() => setShowLibrary(true)}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Library
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default SimplePopup;