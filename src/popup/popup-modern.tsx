import React from 'react';
import { ShowTimelineRequest } from '@/types';

const PopupApp: React.FC = () => {
  const [isYouTubePage, setIsYouTubePage] = React.useState(false);
  const [isShortsPage, setIsShortsPage] = React.useState(false);
  const [videoTitle, setVideoTitle] = React.useState<string>('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [showButton, setShowButton] = React.useState(false);

  // Load button visibility setting
  React.useEffect(() => {
    chrome.storage.sync.get(['buttonVisibility'], (result) => {
      // Default to false if not set
      setShowButton(result.buttonVisibility === true);
    });
  }, []);

  // Check if current tab is YouTube
  React.useEffect(() => {
    const checkCurrentTab = async () => {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const currentTab = tabs[0];

        if (!currentTab || !currentTab.url) return;

        const isYoutubeWatch = currentTab.url.includes('youtube.com/watch');
        const isYoutubeShorts = currentTab.url.includes('youtube.com/shorts');
        const isYoutubePage = isYoutubeWatch || isYoutubeShorts;

        setIsYouTubePage(isYoutubePage);
        setIsShortsPage(isYoutubeShorts);

        if ((isYoutubeWatch || isYoutubeShorts) && currentTab.title) {
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

  // Handle toggle change
  const handleToggleChange = (checked: boolean) => {
    setShowButton(checked);
    // Save to Chrome storage
    chrome.storage.sync.set({ buttonVisibility: checked }, () => {
      
    });
  };

  const handleCreateGif = async () => {
    if (!isYouTubePage) {
      // Open YouTube in new tab
      chrome.tabs.create({ url: 'https://www.youtube.com' });
      window.close();
      return;
    }

    if (isShortsPage) {
      // Show shorts-specific feedback
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

  // Main minimal launcher view
  return (
    <div className="popup-modern" style={{ width: '360px' }}>
      {/* Simple Header */}
      <div className="popup-header">
        <div className="popup-logo-container">
          <img
            src="icons/icon.svg"
            alt="YTGify Logo"
            className="popup-logo-svg"
            style={{ width: '48px', height: '48px' }}
          />
          <div>
            <h1 className="popup-logo-title">YTGify</h1>
            <p className="popup-logo-subtitle">GIF your favorite YouTube moments</p>
          </div>
        </div>
      </div>

      {/* Settings Section */}
      <div className="popup-settings">
        <div className="settings-item">
          <label className="settings-label">
            <span className="settings-text">Pin YTGify button to YouTube player</span>
            <div className="toggle-switch">
              <input
                type="checkbox"
                checked={showButton}
                onChange={(e) => handleToggleChange(e.target.checked)}
                className="toggle-input"
              />
              <span className="toggle-slider"></span>
            </div>
          </label>
        </div>
      </div>

      {/* Main Content */}
      <div className="popup-main">
        {isShortsPage ? (
          <div className="popup-shorts-state">
            <div className="status-text">
              <p className="status-title">YouTube Shorts Detected</p>
              <p className="status-subtitle">We do not yet support YouTube Shorts</p>
            </div>

            {/* Info Icon */}
            <div className="status-icon-container">
              <div className="status-icon info-icon">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>

            {/* Info message */}
            <div className="info-message">
              <p className="info-text">Try GIF creation on regular YouTube videos instead!</p>
            </div>

            {/* Open YouTube Button */}
            <button
              onClick={() => {
                chrome.tabs.create({ url: 'https://www.youtube.com' });
                window.close();
              }}
              className="youtube-button"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
              </svg>
              <span>Open YouTube</span>
            </button>
          </div>
        ) : isYouTubePage ? (
          <div className="popup-ready-state">
            <div className="status-text">
              <p className="status-title">Capture GIF moments from:</p>
              {videoTitle && (
                <p className="video-title">
                  {videoTitle}
                </p>
              )}
            </div>

            {/* Create GIF Button */}
            <button
              onClick={handleCreateGif}
              disabled={isLoading}
              className="create-button"
            >
              {isLoading ? (
                <>
                  <div className="button-spinner"></div>
                  <span>Loading...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span>Create GIF</span>
                </>
              )}
            </button>

            {/* Keyboard shortcut hint */}
            <div className="quick-tip">
              <span className="shortcut-key">Ctrl</span>
              <span className="shortcut-plus">+</span>
              <span className="shortcut-key">Shift</span>
              <span className="shortcut-plus">+</span>
              <span className="shortcut-key">G</span>
              <span className="shortcut-text">Quick access</span>
            </div>
          </div>
        ) : (
          <div className="popup-empty-state">
            {/* Empty State Icon */}
            <div className="status-icon-container">
              <div className="status-icon empty-icon">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
            </div>

            <div className="status-text">
              <p className="status-title">No Video Found</p>
              <p className="status-subtitle">
                Open a YouTube video to start creating GIFs
              </p>
            </div>

            {/* Open YouTube Button */}
            <button
              onClick={handleCreateGif}
              className="youtube-button"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
              </svg>
              <span>Open YouTube</span>
            </button>
          </div>
        )}
      </div>

    </div>
  );
};

export default PopupApp;