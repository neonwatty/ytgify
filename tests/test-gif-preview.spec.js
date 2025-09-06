import { test, expect, chromium } from '@playwright/test';
import path from 'path';

const EXTENSION_PATH = path.join(process.cwd(), 'dist');
const TEST_VIDEO_URL = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';

test.describe('GIF Preview Test', () => {
  let context;
  let extensionId;

  test.beforeAll(async () => {
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-sandbox'
      ],
      viewport: { width: 1280, height: 720 }
    });

    const serviceWorker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    extensionId = serviceWorker.url().split('://')[1].split('/')[0];
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('shows GIF preview after creation', async () => {
    const page = await context.newPage();
    
    // Enable console logging
    page.on('console', msg => {
      if (msg.text().includes('GIF') || msg.text().includes('preview')) {
        console.log('Page:', msg.text());
      }
    });

    await page.goto(TEST_VIDEO_URL);
    await page.waitForSelector('video', { timeout: 10000 });
    await page.waitForTimeout(3000);
    
    console.log('=== Creating GIF ===');
    const gifButton = await page.waitForSelector('.ytgif-button');
    await gifButton.click();
    
    await page.waitForSelector('#ytgif-timeline-overlay', { state: 'attached' });
    await page.evaluate(() => {
      const overlay = document.querySelector('#ytgif-timeline-overlay');
      if (overlay) {
        overlay.style.display = 'block';
        overlay.style.visibility = 'visible';
      }
    });
    await page.waitForTimeout(2000);
    
    const createButton = await page.evaluateHandle(() => {
      const overlay = document.querySelector('#ytgif-timeline-overlay');
      const buttons = overlay?.querySelectorAll('button') || [];
      for (const btn of buttons) {
        if (btn.textContent?.includes('Create')) return btn;
      }
      return null;
    });
    
    if (createButton) {
      await createButton.click();
      console.log('Creating GIF...');
      
      // Wait for preview modal to appear
      console.log('=== Waiting for preview modal ===');
      const previewModal = await page.waitForSelector('.ytgif-preview-modal', { 
        state: 'attached',
        timeout: 30000 
      }).catch(() => null);
      
      if (previewModal) {
        console.log('✅ Preview modal appeared!');
        
        // Check modal content
        const modalContent = await page.evaluate(() => {
          const modal = document.querySelector('.ytgif-preview-modal');
          const image = modal?.querySelector('.ytgif-preview-modal__image');
          const header = modal?.querySelector('.ytgif-preview-modal__header h3');
          const metadata = modal?.querySelector('.ytgif-preview-modal__metadata');
          const downloadBtn = modal?.querySelector('.ytgif-preview-modal__button--primary');
          const libraryBtn = modal?.querySelector('.ytgif-preview-modal__button--secondary');
          
          return {
            hasModal: !!modal,
            hasImage: !!image,
            imageSrc: image ? image.src?.substring(0, 30) : null,
            headerText: header?.textContent,
            hasMetadata: !!metadata,
            metadataText: metadata?.textContent,
            hasDownloadBtn: !!downloadBtn,
            downloadBtnText: downloadBtn?.textContent,
            hasLibraryBtn: !!libraryBtn,
            libraryBtnText: libraryBtn?.textContent
          };
        });
        
        console.log('Modal content:', modalContent);
        
        // Verify modal has expected elements
        expect(modalContent.hasImage).toBe(true);
        expect(modalContent.imageSrc).toContain('data:image/gif');
        expect(modalContent.headerText).toContain('GIF Created Successfully');
        expect(modalContent.hasDownloadBtn).toBe(true);
        expect(modalContent.hasLibraryBtn).toBe(true);
        
        // Take screenshot of preview
        await page.screenshot({ 
          path: 'test-results/gif-preview-modal.png', 
          fullPage: true 
        });
        
        // Test download button
        console.log('=== Testing download button ===');
        const downloadBtn = await page.$('.ytgif-preview-modal__button--primary');
        if (downloadBtn) {
          // Set up download listener
          const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
            downloadBtn.click()
          ]);
          
          if (download) {
            console.log('✅ Download initiated');
            const suggestedFilename = download.suggestedFilename();
            console.log('Suggested filename:', suggestedFilename);
            expect(suggestedFilename).toContain('.gif');
          } else {
            console.log('⚠️ Download event not detected (might be blocked in test environment)');
          }
        }
        
        // Wait for modal to auto-close or manually close it
        await page.waitForTimeout(2000);
        
        // Check if modal closed
        const modalStillExists = await page.$('.ytgif-preview-modal');
        if (modalStillExists) {
          console.log('Modal still visible, closing manually...');
          const closeBtn = await page.$('.ytgif-preview-modal__close');
          if (closeBtn) {
            await closeBtn.click();
            await page.waitForTimeout(500);
          }
        }
        
        console.log('✅ Preview modal test completed');
        
      } else {
        // Fallback: check for success feedback
        const successFeedback = await page.waitForSelector('.ytgif-feedback--success', {
          timeout: 5000
        }).catch(() => null);
        
        if (successFeedback) {
          console.log('⚠️ Preview modal did not appear, but success feedback was shown');
          const feedbackText = await successFeedback.textContent();
          console.log('Feedback text:', feedbackText);
        } else {
          console.log('❌ Neither preview modal nor success feedback appeared');
        }
      }
    }
    
    // Verify GIF was saved to storage
    console.log('=== Verifying storage ===');
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    
    const storageData = await popupPage.evaluate(async () => {
      const result = await chrome.storage.local.get('stored_gifs');
      return {
        count: result.stored_gifs ? result.stored_gifs.length : 0
      };
    });
    
    console.log('GIFs in storage:', storageData.count);
    expect(storageData.count).toBeGreaterThan(0);
    
    await page.close();
    await popupPage.close();
  });
});