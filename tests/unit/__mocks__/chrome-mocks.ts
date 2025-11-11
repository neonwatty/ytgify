/**
 * Comprehensive Chrome Extension API mocks for testing
 *
 * This file provides Jest-compatible mocks for Chrome extension APIs
 * used throughout the YTgify extension.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import manifest from '../../../manifest.json';

export interface MockChrome {
  runtime: any;
  storage: any;
  tabs: any;
  action?: any;
}

/**
 * Creates a comprehensive Chrome API mock object
 */
export function createChromeMock(): MockChrome {
  // Mock data storage for testing
  const mockStorageData = new Map<string, any>();
  const storageListeners: Array<(changes: any, area: string) => void> = [];
  
  // Mock tab data
  const mockTabs = [
    {
      id: 1,
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      active: true,
      windowId: 1,
      title: 'Sample YouTube Video'
    }
  ];

  // Mock runtime message listeners
  const runtimeListeners: Array<(message: any, sender: any, sendResponse: any) => void> = [];

  const chromeMock: MockChrome = {
    runtime: {
      onInstalled: {
        addListener: jest.fn((callback: any) => {
          setTimeout(() => callback({ reason: 'install' }), 0);
        }),
        removeListener: jest.fn()
      },
      onMessage: {
        addListener: jest.fn((listener: any) => {
          runtimeListeners.push(listener);
        }),
        removeListener: jest.fn((listener: any) => {
          const index = runtimeListeners.indexOf(listener);
          if (index > -1) {
            runtimeListeners.splice(index, 1);
          }
        })
      },
      onConnect: {
        addListener: jest.fn(),
        removeListener: jest.fn()
      },
      sendMessage: jest.fn((message: any, callback?: any) => {
        if (callback) {
          setTimeout(() => callback({ success: true }), 10);
        }
        return Promise.resolve({ success: true });
      }),
      connect: jest.fn(() => ({
        postMessage: jest.fn(),
        onMessage: { addListener: jest.fn() },
        onDisconnect: { addListener: jest.fn() }
      })),
      getURL: jest.fn((path: string) => `chrome-extension://mock-extension-id/${path}`),
      id: 'mock-extension-id',
      getManifest: jest.fn(() => ({
        name: manifest.name,
        version: manifest.version,
        manifest_version: manifest.manifest_version
      })),
      OnInstalledReason: {
        INSTALL: 'install',
        UPDATE: 'update',
        CHROME_UPDATE: 'chrome_update',
        SHARED_MODULE_UPDATE: 'shared_module_update'
      }
    },

    storage: {
      sync: {
        get: jest.fn((keys?: any, callback?: any) => {
          const result: Record<string, any> = {};
          
          if (typeof keys === 'string') {
            result[keys] = mockStorageData.get(`sync:${keys}`);
          } else if (Array.isArray(keys)) {
            keys.forEach((key: string) => {
              result[key] = mockStorageData.get(`sync:${key}`);
            });
          } else if (keys === null || keys === undefined) {
            for (const [key, value] of mockStorageData.entries()) {
              if (key.startsWith('sync:')) {
                result[key.replace('sync:', '')] = value;
              }
            }
          }
          
          if (callback) {
            setTimeout(() => callback(result), 0);
          }
          return Promise.resolve(result);
        }),
        
        set: jest.fn((items: any, callback?: any) => {
          const changes: Record<string, { oldValue?: any; newValue: any }> = {};
          
          Object.entries(items as Record<string, any>).forEach(([key, value]) => {
            const storageKey = `sync:${key}`;
            const oldValue = mockStorageData.get(storageKey);
            mockStorageData.set(storageKey, value);
            changes[key] = { oldValue, newValue: value };
          });
          
          setTimeout(() => {
            storageListeners.forEach((listener: any) => listener(changes, 'sync'));
          }, 0);
          
          if (callback) {
            setTimeout(() => callback(), 0);
          }
          return Promise.resolve();
        }),
        
        remove: jest.fn((keys: any, callback?: any) => {
          const keysArray = Array.isArray(keys) ? keys : [keys];
          keysArray.forEach((key: string) => {
            mockStorageData.delete(`sync:${key}`);
          });
          
          if (callback) {
            setTimeout(() => callback(), 0);
          }
          return Promise.resolve();
        }),
        
        clear: jest.fn((callback?: any) => {
          for (const key of mockStorageData.keys()) {
            if (key.startsWith('sync:')) {
              mockStorageData.delete(key);
            }
          }
          
          if (callback) {
            setTimeout(() => callback(), 0);
          }
          return Promise.resolve();
        }),
        
        getBytesInUse: jest.fn((keys?: any, callback?: any) => {
          const result = 1024;
          if (callback) {
            setTimeout(() => callback(result), 0);
          }
          return Promise.resolve(result);
        })
      },

      local: {
        get: jest.fn((keys?: any, callback?: any) => {
          const result: Record<string, any> = {};
          
          if (typeof keys === 'string') {
            result[keys] = mockStorageData.get(`local:${keys}`);
          } else if (Array.isArray(keys)) {
            keys.forEach((key: string) => {
              result[key] = mockStorageData.get(`local:${key}`);
            });
          } else if (keys === null || keys === undefined) {
            for (const [key, value] of mockStorageData.entries()) {
              if (key.startsWith('local:')) {
                result[key.replace('local:', '')] = value;
              }
            }
          }
          
          if (callback) {
            setTimeout(() => callback(result), 0);
          }
          return Promise.resolve(result);
        }),
        
        set: jest.fn((items: any, callback?: any) => {
          const changes: Record<string, { oldValue?: any; newValue: any }> = {};
          
          Object.entries(items as Record<string, any>).forEach(([key, value]) => {
            const storageKey = `local:${key}`;
            const oldValue = mockStorageData.get(storageKey);
            mockStorageData.set(storageKey, value);
            changes[key] = { oldValue, newValue: value };
          });
          
          setTimeout(() => {
            storageListeners.forEach((listener: any) => listener(changes, 'local'));
          }, 0);
          
          if (callback) {
            setTimeout(() => callback(), 0);
          }
          return Promise.resolve();
        }),
        
        remove: jest.fn((keys: any, callback?: any) => {
          const keysArray = Array.isArray(keys) ? keys : [keys];
          keysArray.forEach((key: string) => {
            mockStorageData.delete(`local:${key}`);
          });
          
          if (callback) {
            setTimeout(() => callback(), 0);
          }
          return Promise.resolve();
        }),
        
        clear: jest.fn((callback?: any) => {
          for (const key of mockStorageData.keys()) {
            if (key.startsWith('local:')) {
              mockStorageData.delete(key);
            }
          }
          
          if (callback) {
            setTimeout(() => callback(), 0);
          }
          return Promise.resolve();
        }),
        
        getBytesInUse: jest.fn((keys?: any, callback?: any) => {
          const result = 2048;
          if (callback) {
            setTimeout(() => callback(result), 0);
          }
          return Promise.resolve(result);
        })
      },

      onChanged: {
        addListener: jest.fn((listener: any) => {
          storageListeners.push(listener);
        }),
        removeListener: jest.fn((listener: any) => {
          const index = storageListeners.indexOf(listener);
          if (index > -1) {
            storageListeners.splice(index, 1);
          }
        })
      }
    },

    tabs: {
      query: jest.fn((queryInfo: any, callback?: any) => {
        let filteredTabs = [...mockTabs];
        
        if (queryInfo.active === true) {
          filteredTabs = filteredTabs.filter(tab => tab.active);
        }
        
        if (queryInfo.url) {
          filteredTabs = filteredTabs.filter(tab => 
            tab.url.includes(queryInfo.url.replace('*', ''))
          );
        }
        
        if (callback) {
          setTimeout(() => callback(filteredTabs), 0);
        }
        return Promise.resolve(filteredTabs);
      }),
      
      get: jest.fn((tabId: number, callback?: any) => {
        const tab = mockTabs.find(t => t.id === tabId);
        if (callback) {
          setTimeout(() => callback(tab), 0);
        }
        return Promise.resolve(tab);
      }),
      
      sendMessage: jest.fn((tabId: number, message: any, callback?: any) => {
        const response = { success: true, tabId, message };
        if (callback) {
          setTimeout(() => callback(response), 10);
        }
        return Promise.resolve(response);
      }),
      
      create: jest.fn((createProperties: any, callback?: any) => {
        const newTab = {
          id: mockTabs.length + 1,
          url: createProperties.url || 'about:blank',
          active: createProperties.active !== false,
          windowId: 1,
          title: 'New Tab'
        };
        mockTabs.push(newTab);
        
        if (callback) {
          setTimeout(() => callback(newTab), 0);
        }
        return Promise.resolve(newTab);
      }),
      
      update: jest.fn((tabId: number, updateProperties: any, callback?: any) => {
        const tab = mockTabs.find(t => t.id === tabId);
        if (tab) {
          Object.assign(tab, updateProperties);
        }
        
        if (callback) {
          setTimeout(() => callback(tab), 0);
        }
        return Promise.resolve(tab);
      }),
      
      remove: jest.fn((tabId: number, callback?: any) => {
        const index = mockTabs.findIndex(t => t.id === tabId);
        if (index > -1) {
          mockTabs.splice(index, 1);
        }
        
        if (callback) {
          setTimeout(() => callback(), 0);
        }
        return Promise.resolve();
      }),
      
      onUpdated: {
        addListener: jest.fn(),
        removeListener: jest.fn()
      },
      
      onActivated: {
        addListener: jest.fn(),
        removeListener: jest.fn()
      }
    },

    action: {
      onClicked: {
        addListener: jest.fn(),
        removeListener: jest.fn()
      },
      
      setPopup: jest.fn((details: any, callback?: any) => {
        if (callback) {
          setTimeout(() => callback(), 0);
        }
        return Promise.resolve();
      }),
      
      getPopup: jest.fn((details: any, callback?: any) => {
        const result = { popup: 'popup.html' };
        if (callback) {
          setTimeout(() => callback(result), 0);
        }
        return Promise.resolve(result);
      }),
      
      setBadgeText: jest.fn((details: any, callback?: any) => {
        if (callback) {
          setTimeout(() => callback(), 0);
        }
        return Promise.resolve();
      }),
      
      setBadgeBackgroundColor: jest.fn((details: any, callback?: any) => {
        if (callback) {
          setTimeout(() => callback(), 0);
        }
        return Promise.resolve();
      })
    }
  };

  return chromeMock;
}

/**
 * Helper function to simulate Chrome runtime message sending
 */
export function simulateRuntimeMessage(
  chromeMock: MockChrome,
  message: any,
  sender: any = { tab: { id: 1 } }
): Promise<any> {
  return new Promise((resolve, reject) => {
    const sendResponse = jest.fn((response: any) => {
      resolve(response);
    });

    // Get registered listeners from mock calls
    const addListenerMock = chromeMock.runtime.onMessage.addListener as jest.MockedFunction<any>;
    const calls = addListenerMock.mock.calls;
    
    if (calls.length > 0) {
      const listener = calls[0][0]; // Get first registered listener
      try {
        const result = listener(message, sender, sendResponse);
        
        // If listener returns true, it means it will respond asynchronously
        // If it doesn't return true and hasn't called sendResponse, send default response
        if (!result && !sendResponse.mock.calls.length) {
          sendResponse({ success: true });
        }
        
        // Add timeout to prevent hanging if async response never comes
        setTimeout(() => {
          if (!sendResponse.mock.calls.length) {
            reject(new Error('Message handler timeout - no response received'));
          }
        }, 1000);
        
      } catch (error: any) {
        sendResponse({ error: error.message });
      }
    } else {
      sendResponse({ success: true });
    }
  });
}

/**
 * Helper function to simulate Chrome storage changes
 * This uses the actual storageListeners array to only call currently active listeners
 */
export function simulateStorageChange(
  chromeMock: MockChrome,
  changes: Record<string, { oldValue?: any; newValue?: any }>,
  areaName: 'sync' | 'local' = 'sync'
): void {
  // Simulate storage changes by tracking which listeners are currently active
  
  // For simplicity in tests, let's just call the listeners that are currently registered
  // by examining the mock calls and their removal status
  const addCalls = (chromeMock.storage.onChanged.addListener as jest.MockedFunction<any>).mock.calls;
  const removeCalls = (chromeMock.storage.onChanged.removeListener as jest.MockedFunction<any>).mock.calls;
  
  // Build list of active listeners (added but not removed)
  const activeListeners: any[] = [];
  
  addCalls.forEach((addCall: any[]) => {
    const listener = addCall[0];
    // Check if this listener was later removed
    const wasRemoved = removeCalls.some((removeCall: any[]) => removeCall[0] === listener);
    if (!wasRemoved) {
      activeListeners.push(listener);
    }
  });
  
  // Call only active listeners
  activeListeners.forEach((listener: any) => {
    try {
      listener(changes, areaName);
    } catch (error) {
      console.error('Error in storage change listener:', error);
    }
  });
}

/**
 * Helper function to reset all mock data and call counts
 */
export function resetChromeMocks(chromeMock: MockChrome): void {
  // Reset all Jest mocks recursively
  const resetMocks = (obj: any) => {
    for (const key in obj) {
      if (obj[key] && typeof obj[key] === 'object') {
        if (jest.isMockFunction(obj[key])) {
          obj[key].mockReset();
        } else {
          resetMocks(obj[key]);
        }
      }
    }
  };
  
  resetMocks(chromeMock);
  
  // Clear stored data
  chromeMock.storage.sync.clear();
  chromeMock.storage.local.clear();
}

/**
 * Export the default chrome mock instance
 */
export const chromeMock = createChromeMock();

// Set up global chrome mock
(global as any).chrome = chromeMock;