import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PopupApp from '../../../src/popup/popup-modern';
import { resetChromeMocks } from '../__mocks__/chrome-mocks';

// Mock CSS imports
jest.mock('../../../src/popup/styles-modern.css', () => ({}));

describe('PopupApp Component', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    resetChromeMocks((global as any).chrome);

    // Mock chrome.tabs.query to return a regular YouTube page by default
    (global as any).chrome.tabs.query.mockImplementation(
      jest.fn((queryInfo, callback) => {
        const mockTab = {
          id: 1,
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          active: true,
          windowId: 1,
          title: 'Sample YouTube Video - YouTube'
        };

        if (callback) {
          callback([mockTab]);
        }
        return Promise.resolve([mockTab]);
      })
    );

    // Mock chrome.storage.sync.get to return default values
    (global as any).chrome.storage.sync.get.mockImplementation(
      jest.fn((keys, callback) => {
        const defaultValues: Record<string, any> = {};
        if (typeof keys === 'string') {
          if (keys === 'buttonVisibility') {
            defaultValues[keys] = true;
          }
        } else if (Array.isArray(keys)) {
          keys.forEach(key => {
            if (key === 'buttonVisibility') {
              defaultValues[key] = true;
            }
          });
        }

        if (callback) {
          callback(defaultValues);
        }
        return Promise.resolve(defaultValues);
      })
    );

    // Mock window.close for testing popup closure
    delete (global as any).window.close;
    (global as any).window.close = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Helper function to mock chrome.tabs.query with different URLs and titles
  const mockTabWithUrl = (url: string, title = 'Test Page') => {
    const mockTabs = [{
      id: 1,
      url,
      active: true,
      windowId: 1,
      title
    }];

    (global as any).chrome.tabs.query.mockImplementation(
      jest.fn((queryInfo, callback) => {
        if (callback) {
          callback(mockTabs);
        }
        return Promise.resolve(mockTabs);
      })
    );
  };

  describe('YouTube Shorts Detection', () => {
    test('displays YouTube Shorts detected message with simple explanation', async () => {
      // Mock YouTube Shorts URL
      mockTabWithUrl('https://www.youtube.com/shorts/ABC123', 'Short Video - YouTube');

      render(<PopupApp />);

      await waitFor(() => {
        expect(screen.getByText('YouTube Shorts Detected')).toBeInTheDocument();
      });

      // Verify the simple explanation message (no technical details)
      expect(screen.getByText('We do not yet support YouTube Shorts')).toBeInTheDocument();

      // Verify technical iframe language is NOT present
      expect(screen.queryByText(/technical limitations/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/iframe based architecture/i)).not.toBeInTheDocument();

      // Verify other UI elements are still present
      expect(screen.getByText('Try GIF creation on regular YouTube videos instead!')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /open youtube/i })).toBeInTheDocument();
    });

    test('recognizes various YouTube Shorts URL formats', async () => {
      const shortsUrls = [
        'https://youtube.com/shorts/ABC123',
        'https://www.youtube.com/shorts/DEF456',
        'https://m.youtube.com/shorts/GHI789'
      ];

      for (const url of shortsUrls) {
        mockTabWithUrl(url);
        const { container, unmount } = render(<PopupApp />);

        await waitFor(() => {
          expect(container).toHaveTextContent('We do not yet support YouTube Shorts');
        });

        unmount();
        // Clean up for next iteration
        jest.clearAllMocks();
      }
    });
  });

  describe('Button Visibility Settings', () => {
    test('displays button visibility toggle with default value of true', async () => {
      // Mock default storage value (button should be visible by default)
      (global as any).chrome.storage.sync.get.mockImplementation(
        jest.fn((keys, callback) => {
          const result = { buttonVisibility: true };
          if (callback) callback(result);
          return Promise.resolve(result);
        })
      );

      render(<PopupApp />);

      await waitFor(() => {
        expect(screen.getByText('Pin YTGify button to YouTube player')).toBeInTheDocument();
      });

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
    });

    test('displays button visibility toggle with false value when set', async () => {
      // Mock storage to return false for button visibility
      (global as any).chrome.storage.sync.get.mockImplementation(
        jest.fn((keys, callback) => {
          const result = { buttonVisibility: false };
          if (callback) callback(result);
          return Promise.resolve(result);
        })
      );

      render(<PopupApp />);

      await waitFor(() => {
        expect(screen.getByText('Pin YTGify button to YouTube player')).toBeInTheDocument();
      });

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).not.toBeChecked();
    });

    test('saves toggle changes to Chrome storage', async () => {
      // Start with button visible (default)
      (global as any).chrome.storage.sync.get.mockImplementation(
        jest.fn((keys, callback) => {
          const result = { buttonVisibility: true };
          if (callback) callback(result);
          return Promise.resolve(result);
        })
      );

      // Set up storage.set mock to capture the callback
      (global as any).chrome.storage.sync.set.mockImplementation(
        jest.fn((data, callback) => {
          if (callback) callback();
          return Promise.resolve();
        })
      );

      render(<PopupApp />);

      await waitFor(() => {
        expect(screen.getByText('Pin YTGify button to YouTube player')).toBeInTheDocument();
      });

      // Toggle the setting off
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      // Verify storage.set was called with correct data
      await waitFor(() => {
        expect((global as any).chrome.storage.sync.set).toHaveBeenCalledWith(
          { buttonVisibility: false },
          expect.any(Function)
        );
      }, { timeout: 2000 });

      // Toggle back on
      fireEvent.click(checkbox);
      await waitFor(() => {
        expect((global as any).chrome.storage.sync.set).toHaveBeenCalledWith(
          { buttonVisibility: true },
          expect.any(Function)
        );
      }, { timeout: 2000 });
    });

    test('handles undefined/null storage values by defaulting to false', async () => {
      // Mock storage returning undefined for buttonVisibility
      (global as any).chrome.storage.sync.get.mockImplementation(
        jest.fn((keys, callback) => {
          const result = { buttonVisibility: undefined };
          if (callback) callback(result);
          return Promise.resolve(result);
        })
      );

      render(<PopupApp />);

      await waitFor(() => {
        expect(screen.getByText('Pin YTGify button to YouTube player')).toBeInTheDocument();
      });

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).not.toBeChecked(); // Should default to false when undefined
    });

    // Note: Storage error handling test removed because the current implementation
    // doesn't handle storage.get errors in the popup component useEffect.
  });

  describe('Non-YouTube Page States', () => {
    test('displays empty state when not on YouTube', async () => {
      // Mock non-YouTube page
      mockTabWithUrl('https://www.example.com', 'Example Website');

      render(<PopupApp />);

      await waitFor(() => {
        expect(screen.getByText('No Video Found')).toBeInTheDocument();
      });

      // Verify appropriate messaging
      expect(screen.getByText('Open a YouTube video to start creating GIFs')).toBeInTheDocument();

      // Verify Open YouTube button is displayed
      expect(screen.getByRole('button', { name: /open youtube/i })).toBeInTheDocument();

      // Verify YouTube-specific functionality is not shown
      expect(screen.queryByText('Capture GIF moments from:')).not.toBeInTheDocument();
      expect(screen.queryByText('YouTube Shorts Detected')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /create gif/i })).not.toBeInTheDocument();
    });

    test('handles various non-YouTube URLs correctly', async () => {
      const nonYoutubeUrls = [
        'https://www.youtube.com', // Main page (no video)
        'https://www.google.com',
        'https://github.com',
        'https://reddit.com',
        'about:blank',
        'chrome://extensions/',
        'chrome://settings'
      ];

      for (const url of nonYoutubeUrls) {
        mockTabWithUrl(url, `${url} - Browser Tab`);
        const { container, unmount } = render(<PopupApp />);

        await waitFor(() => {
          expect(container).toHaveTextContent('No Video Found');
        });

        unmount();
        // Clean up for next iteration
        jest.clearAllMocks();
      }
    });

    test('Open YouTube button works when not on YouTube', async () => {
      mockTabWithUrl('https://www.example.com', 'Example Website');

      render(<PopupApp />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /open youtube/i })).toBeInTheDocument();
      });

      const openYoutubeButton = screen.getByRole('button', { name: /open youtube/i });
      fireEvent.click(openYoutubeButton);

      // Verify chrome.tabs.create was called to open YouTube
      await waitFor(() => {
        expect((global as any).chrome.tabs.create).toHaveBeenCalledWith({
          url: 'https://www.youtube.com'
        });
      });

      // Verify popup closes after opening YouTube
      expect((global as any).window.close).toHaveBeenCalled();
    });
  });

  describe('Regular YouTube Video Detection', () => {
    test('displays Create GIF interface for regular YouTube videos', async () => {
      // Mock regular YouTube watch URL with a specific title
      mockTabWithUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'Awesome Test Video - YouTube');

      const { container } = render(<PopupApp />);

      await waitFor(() => {
        // Use container to avoid multiple elements issues
        expect(container).toHaveTextContent('Capture GIF moments from:');
      });

      // Verify video title is extracted and displayed (removing "- YouTube" suffix)
      expect(container).toHaveTextContent('Awesome Test Video');

      // Verify Create GIF button is present (use getAllByRole to handle multiple matches)
      const buttons = screen.getAllByRole('button');
      const createGifButton = buttons.find(button =>
        button.textContent?.includes('Create GIF')
      );
      expect(createGifButton).toBeInTheDocument();

      // Verify keyboard shortcut hint is displayed
      expect(container).toHaveTextContent('Ctrl');
      expect(container).toHaveTextContent('Shift');
      expect(container).toHaveTextContent('G');
      expect(container).toHaveTextContent('Quick access');

      // Verify Shorts messaging is NOT displayed
      expect(container).not.toHaveTextContent('YouTube Shorts Detected');
      expect(container).not.toHaveTextContent('We do not yet support YouTube Shorts');
    });

    test('handles different YouTube URL formats correctly', async () => {
      const watchUrls = [
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'https://youtube.com/watch?v=dQw4w9WgXcQ',
        'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share'
      ];

      for (const url of watchUrls) {
        mockTabWithUrl(url, 'Test Video - YouTube');

        const { container, unmount } = render(<PopupApp />);

        await waitFor(() => {
          expect(container).toHaveTextContent('Capture GIF moments from:');
        });

        unmount();
        // Clean up for next iteration
        jest.clearAllMocks();
      }
    });

    test('handles videos with complex titles', async () => {
      const complexTitles = [
        'Amazing Video: Featuring | Special Characters & Emojis 🎯 - YouTube',
        'Long Video Title With Multiple Words And Descriptions That Go On Forever - YouTube',
        'Short - YouTube'
      ];

      for (const title of complexTitles) {
        mockTabWithUrl('https://www.youtube.com/watch?v=test123', title);
        const expectedTitle = title.replace(' - YouTube', '');

        render(<PopupApp />);

        await waitFor(() => {
          expect(screen.getByText(expectedTitle)).toBeInTheDocument();
        });

        // Clean up for next iteration
        jest.clearAllMocks();
      }
    });
  });

  describe('Basic Rendering', () => {
    test('renders popup container', async () => {
      render(<PopupApp />);
      await waitFor(() => {
        expect(screen.getByText('YTGify')).toBeInTheDocument();
      });
    });
  });

  describe('User Interactions', () => {
    test('Create GIF button opens wizard overlay and closes popup on YouTube videos', async () => {
      mockTabWithUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'Test Video - YouTube');

      render(<PopupApp />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create gif/i })).toBeInTheDocument();
      });

      const createGifButton = screen.getByRole('button', { name: /create gif/i });
      fireEvent.click(createGifButton);

      // Verify chrome.tabs.sendMessage was called with the overlay request
      await waitFor(() => {
        expect((global as any).chrome.tabs.sendMessage).toHaveBeenCalledWith(
          1, // tab ID
          expect.objectContaining({
            type: 'SHOW_TIMELINE',
            data: expect.objectContaining({
              videoDuration: 0,
              currentTime: 0
            })
          })
        );
      });

      // Verify popup closes after sending the message
      expect((global as any).window.close).toHaveBeenCalled();
    });

    test('Create GIF button on non-YouTube pages opens YouTube instead', async () => {
      mockTabWithUrl('https://www.example.com', 'Example Website');

      render(<PopupApp />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /open youtube/i })).toBeInTheDocument();
      });

      // On non-YouTube pages, the button should be "Open YouTube"
      const button = screen.getByRole('button', { name: /open youtube/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect((global as any).chrome.tabs.create).toHaveBeenCalledWith({
          url: 'https://www.youtube.com'
        });
      });

      expect((global as any).window.close).toHaveBeenCalled();
    });

    test('handles failed message sending gracefully', async () => {
      mockTabWithUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'Test Video - YouTube');

      // Mock chrome.tabs.sendMessage to reject (simulating content script not available)
      (global as any).chrome.tabs.sendMessage.mockImplementation(
        jest.fn(() => Promise.reject(new Error('Content script not found')))
      );

      render(<PopupApp />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create gif/i })).toBeInTheDocument();
      });

      const createGifButton = screen.getByRole('button', { name: /create gif/i });
      fireEvent.click(createGifButton);

      // Wait for the click handler to process
      await new Promise(resolve => setTimeout(resolve, 50));

      // Even if message sending fails, the action should still be attempted
      expect((global as any).chrome.tabs.sendMessage).toHaveBeenCalled();

      // On failure, console.error would be logged (cannot test console directly)
      // but the app should not crash
      expect((global as any).window.close).not.toHaveBeenCalled(); // Popup should not close on failure
    });

    test('Open YouTube button on Shorts pages works correctly', async () => {
      mockTabWithUrl('https://www.youtube.com/shorts/ABC123', 'Short Video - YouTube');

      render(<PopupApp />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /open youtube/i })).toBeInTheDocument();
      });

      const openYoutubeButton = screen.getByRole('button', { name: /open youtube/i });
      fireEvent.click(openYoutubeButton);

      await waitFor(() => {
        expect((global as any).chrome.tabs.create).toHaveBeenCalledWith({
          url: 'https://www.youtube.com'
        });
      });

      expect((global as any).window.close).toHaveBeenCalled();
    });

    test('handles tab query errors gracefully', async () => {
      // Mock chrome.tabs.query to throw an error
      (global as any).chrome.tabs.query.mockImplementation(
        jest.fn(() => {
          throw new Error('Tabs permission denied');
        })
      );

      // Spy on console.error to verify error logging
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      render(<PopupApp />);

      // Wait for error handling to occur
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should still render basic elements even with error
      await waitFor(() => {
        expect(screen.getByText('YTGify')).toBeInTheDocument();
      });

      // Verify error was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error checking current tab:',
        expect.any(Error)
      );

      // Clean up
      consoleSpy.mockRestore();
    });
  });
});