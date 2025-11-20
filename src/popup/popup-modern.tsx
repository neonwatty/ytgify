import React from 'react';
import { ShowTimelineRequest } from '@/types';
import { engagementTracker } from '@/shared/engagement-tracker';
import { openExternalLink, getReviewLink } from '@/constants/links';

const PopupApp: React.FC = () => {
  const [isYouTubePage, setIsYouTubePage] = React.useState(false);
  const [isShortsPage, setIsShortsPage] = React.useState(false);
  const [videoTitle, setVideoTitle] = React.useState<string>('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [showButton, setShowButton] = React.useState(false);
  const [showFooter, setShowFooter] = React.useState(false);
  const [version, setVersion] = React.useState<string>('');

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

  // Check footer qualification on mount
  React.useEffect(() => {
    const checkFooter = async () => {
      try {
        const stats = await engagementTracker.getEngagementStats();
        const qualifies = await engagementTracker.shouldShowPrompt();
        const dismissed = stats.popupFooterDismissed;
        setShowFooter(qualifies && !dismissed);
      } catch (error) {
        console.error('Error checking footer qualification:', error);
      }
    };
    checkFooter();
  }, []);

  // Load extension version
  React.useEffect(() => {
    try {
      const manifest = chrome.runtime.getManifest();
      setVersion(manifest.version || '');
    } catch (error) {
      console.error('Error loading version:', error);
    }
  }, []);

  // Handle toggle change
  const handleToggleChange = (checked: boolean) => {
    setShowButton(checked);
    // Save to Chrome storage
    chrome.storage.sync.set({ buttonVisibility: checked }, () => {

    });
  };

  // Handle footer actions
  const handleReview = () => {
    openExternalLink(getReviewLink());
  };

  const handleDismissFooter = async () => {
    await engagementTracker.recordDismissal('popup-footer');
    setShowFooter(false);
  };

  const handleStayConnected = () => {
    openExternalLink('https://discord.gg/8EUxqR93');
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

            {/* Stay Connected Button */}
            <div className="popup-stay-connected-section">
              <button className="popup-stay-connected-btn" onClick={handleStayConnected}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515a.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0a12.64 12.64 0 00-.617-1.25a.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057a19.9 19.9 0 005.993 3.03a.078.078 0 00.084-.028a14.09 14.09 0 001.226-1.994a.076.076 0 00-.041-.106a13.107 13.107 0 01-1.872-.892a.077.077 0 01-.008-.128a10.2 10.2 0 00.372-.292a.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127a12.299 12.299 0 01-1.873.892a.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028a19.839 19.839 0 006.002-3.03a.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
                <span>Join Discord</span>
              </button>
              <p className="popup-stay-connected-subtitle">Community Support & Updates</p>
            </div>
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

            {/* Stay Connected Button */}
            <div className="popup-stay-connected-section">
              <button className="popup-stay-connected-btn" onClick={handleStayConnected}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515a.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0a12.64 12.64 0 00-.617-1.25a.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057a19.9 19.9 0 005.993 3.03a.078.078 0 00.084-.028a14.09 14.09 0 001.226-1.994a.076.076 0 00-.041-.106a13.107 13.107 0 01-1.872-.892a.077.077 0 01-.008-.128a10.2 10.2 0 00.372-.292a.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127a12.299 12.299 0 01-1.873.892a.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028a19.839 19.839 0 006.002-3.03a.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
                <span>Join Discord</span>
              </button>
              <p className="popup-stay-connected-subtitle">Community Support & Updates</p>
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

          {/* Footer CTA */}
          {showFooter && (
            <div className="popup-footer">
              <span>Enjoying YTGify? </span>
              <a onClick={handleReview}>Leave us a review!</a>
              <button className="dismiss-btn" onClick={handleDismissFooter}>×</button>
            </div>
          )}

          {/* Version Footer */}
          <div className="popup-version">
            v{version}
          </div>
    </div>
  );
};

export default PopupApp;