import { test, expect, chromium } from '@playwright/test';
import path from 'path';

const EXTENSION_PATH = path.join(process.cwd(), 'dist');

test.describe('Database Isolation Test', () => {
  let context;
  let extensionId;

  test.beforeAll(async () => {
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-sandbox'
      ]
    });

    const serviceWorker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    extensionId = serviceWorker.url().split('://')[1].split('/')[0];
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('check IndexedDB isolation between contexts', async () => {
    // Test 1: Create DB in popup
    console.log('\n=== Creating test DB in popup ===');
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    
    const popupResult = await popupPage.evaluate(async () => {
      const dbName = 'TestDB';
      const request = indexedDB.open(dbName, 1);
      
      return new Promise((resolve) => {
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('test')) {
            db.createObjectStore('test', { keyPath: 'id' });
          }
        };
        
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction(['test'], 'readwrite');
          const store = transaction.objectStore('test');
          store.put({ id: 'popup-test', value: 'from-popup' });
          
          transaction.oncomplete = () => {
            resolve({ success: true, origin: window.location.origin });
          };
        };
        
        request.onerror = () => {
          resolve({ success: false, error: 'Failed to create DB' });
        };
      });
    });
    console.log('Popup DB creation:', popupResult);
    
    // Test 2: Try to access from YouTube page
    console.log('\n=== Trying to access popup DB from YouTube page ===');
    const ytPage = await context.newPage();
    await ytPage.goto('https://www.youtube.com');
    
    const ytResult = await ytPage.evaluate(async () => {
      const dbName = 'TestDB';
      try {
        const request = indexedDB.open(dbName, 1);
        
        return new Promise((resolve) => {
          request.onsuccess = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains('test')) {
              resolve({ found: false, reason: 'Store does not exist', origin: window.location.origin });
              return;
            }
            
            const transaction = db.transaction(['test'], 'readonly');
            const store = transaction.objectStore('test');
            const getRequest = store.get('popup-test');
            
            getRequest.onsuccess = () => {
              if (getRequest.result) {
                resolve({ found: true, value: getRequest.result.value, origin: window.location.origin });
              } else {
                resolve({ found: false, reason: 'No data found', origin: window.location.origin });
              }
            };
          };
          
          request.onupgradeneeded = () => {
            resolve({ found: false, reason: 'DB does not exist (upgrade triggered)', origin: window.location.origin });
          };
          
          request.onerror = () => {
            resolve({ found: false, error: 'Failed to open DB', origin: window.location.origin });
          };
        });
      } catch (error) {
        return { found: false, error: error.message, origin: window.location.origin };
      }
    });
    console.log('YouTube page access result:', ytResult);
    
    // Test 3: Try to access from background/service worker
    console.log('\n=== Checking service worker access ===');
    const swResult = await popupPage.evaluate(async () => {
      const response = await chrome.runtime.sendMessage({ 
        type: 'TEST_DB_ACCESS',
        dbName: 'TestDB'
      }).catch(err => ({ error: err.message }));
      return response;
    });
    console.log('Service worker access:', swResult);
    
    // Analysis
    console.log('\n=== Analysis ===');
    if (ytResult.found) {
      console.log('❌ UNEXPECTED: YouTube page can access popup IndexedDB');
      console.log('This means they share the same storage');
    } else {
      console.log('✅ YouTube page CANNOT access popup IndexedDB');
      console.log(`Popup origin: ${popupResult.origin}`);
      console.log(`YouTube origin: ${ytResult.origin}`);
      console.log('IndexedDB is isolated per origin - this is the issue!');
      console.log('\nSOLUTION: GIFs must be saved from the extension context, not the content script');
    }
  });
});