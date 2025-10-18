# Manual Screenshot Capture Guide

## Quick Instructions for Capturing All CTA Screenshots

### Prerequisites
Extension already built at `dist/` folder.

---

## Step-by-Step Guide

### 1. Load Extension in Chrome

```bash
# From project root
npm run build
```

1. Open Chrome
2. Navigate to `chrome://extensions/`
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked**
5. Select the `dist/` folder from this project
6. Extension should now appear in toolbar

---

### 2. Enable YTGify Button

1. Click the YTGify extension icon in Chrome toolbar
2. Toggle **"Pin YTGify button to YouTube player"** to ON (red)
3. The toggle should turn red when enabled

---

### 3. Capture Popup Screenshot

✅ **Already captured:** `screenshots/01-popup-main.png`

To capture again:
1. Click YTGify extension icon
2. Take screenshot of popup
3. Save as `screenshots/01-popup-main.png`

---

### 4. Capture Wizard Screens

#### 4a. Navigate to YouTube Video
1. Go to any YouTube video (example: https://www.youtube.com/watch?v=jNQXAC9IVRw)
2. Wait for video to load completely
3. Wait 2-3 seconds for YTGify button to appear on player

#### 4b. QuickCapture Screen
1. Click the **YTGify** button on YouTube player controls
2. Wizard opens with QuickCapture screen
3. Screenshot the wizard overlay
4. Save as `screenshots/02-quickcapture-screen.png`

#### 4c. Text Overlay Screen (Empty)
1. From QuickCapture screen, click **Next** button
2. Text Overlay screen appears
3. Screenshot the wizard (before entering text)
4. Save as `screenshots/03-text-overlay-empty.png`

#### 4d. Text Overlay Screen (With Text)
1. In the text input field, type: "Check out YTGify!"
2. Screenshot the wizard (with text entered)
3. Save as `screenshots/04-text-overlay-with-text.png`

#### 4e. Processing Screen
1. Click **Create GIF** button
2. Processing screen appears with progress bar
3. Screenshot while processing
4. Save as `screenshots/05-processing-screen.png`

#### 4f. Success Screen (with Share Link)
1. Wait for GIF creation to complete
2. Success screen appears
3. **Look for:** "Spread the word about YTGify" link at bottom
4. Screenshot the complete screen showing:
   - Download button
   - View GIF button
   - **Share link** (new CTA feature)
5. Save as `screenshots/06-success-screen.png`

#### 4g. Feedback Screen (with Support Section)
1. From Success screen, click **Done** or close button
2. Feedback screen appears
3. **Look for:** "Show Your Support" section with 3 buttons:
   - Rate YTGify
   - Share on X
   - Star on GitHub
4. Screenshot the complete screen
5. Save as `screenshots/07-feedback-screen.png`

---

### 5. Capture Milestone Screen

Milestone screen appears **only** when creating exactly the 10th, 25th, or 50th GIF.

#### Option A: Trigger 10 GIF Milestone
1. Create 10 GIFs total (track count in popup)
2. On the **10th GIF completion**, MilestoneScreen appears
3. Screenshot shows:
   - "You've created 10 GIFs! 🎉"
   - Share button
   - Continue button
4. Save as `screenshots/08-milestone-10-gifs.png`

#### Option B: Use Browser DevTools (Quick Method)
1. Open YouTube video, click YTGify button
2. Open Chrome DevTools (F12)
3. In Console, run:
```javascript
// Set engagement data to trigger milestone
chrome.storage.local.set({
  'engagement-data': {
    installDate: Date.now() - (15 * 24 * 60 * 60 * 1000),
    totalGifsCreated: 10,
    prompts: { primary: { shown: false }, secondary: { shown: false } },
    milestones: { milestone10: false, milestone25: false, milestone50: false },
    popupFooterDismissed: false
  }
});
```
4. Create one GIF
5. MilestoneScreen should appear after creation
6. Screenshot and save

---

## Screenshot Checklist

- [x] `01-popup-main.png` - Main popup ✅ **Captured**
- [ ] `02-quickcapture-screen.png` - Initial wizard screen
- [ ] `03-text-overlay-empty.png` - Text overlay (no text)
- [ ] `04-text-overlay-with-text.png` - Text overlay (with text)
- [ ] `05-processing-screen.png` - GIF creation in progress
- [ ] `06-success-screen.png` - Success with **Share link** (CTA)
- [ ] `07-feedback-screen.png` - Feedback with **Support section** (CTA)
- [ ] `08-milestone-10-gifs.png` - Milestone celebration (CTA)

**Optional:**
- [ ] `09-milestone-25-gifs.png` - 25 GIF milestone
- [ ] `10-milestone-50-gifs.png` - 50 GIF milestone

---

## CTA Features to Highlight in Screenshots

### Success Screen (Screenshot #6)
**New Feature:** "Spread the word about YTGify" share link
- Located below download/view buttons
- Opens Twitter share dialog
- Uses short template

### Feedback Screen (Screenshot #7)
**New Feature:** "Show Your Support" section
- Three buttons: Rate, Share, Star
- All open in new tabs
- Professional CTAs without being pushy

### Milestone Screen (Screenshot #8)
**New Feature:** Milestone celebrations
- Appears at 10, 25, 50 GIFs
- Animated celebration message
- Share button to spread achievement
- Continue button to proceed

---

## Troubleshooting

### YTGify Button Not Appearing
- Ensure button visibility is enabled in popup
- Refresh YouTube page
- Wait 3-5 seconds after page load
- Check YouTube player controls (bottom right area)

### Extension Not Loading
- Check `chrome://extensions/`
- Ensure YTGify is enabled
- Look for error messages
- Try reloading extension

### Screenshots Not Showing CTAs
- Ensure using latest build (`npm run build`)
- CTAs appear after GIF creation
- Check engagement data in DevTools:
  ```javascript
  chrome.storage.local.get('engagement-data', console.log)
  ```

---

## Alternative: Automated Script

An automated script is available but has limitations:
```bash
npx ts-node --esm scripts/capture-all-screenshots.ts
```

Limitations:
- Button visibility timing issues
- Cannot fully automate GIF creation
- Best for popup screenshot only

**Recommendation:** Manual capture is more reliable for wizard screens.

---

## After Capturing Screenshots

1. Review all screenshots in `screenshots/` folder
2. Ensure CTAs are visible and clear
3. Check image quality (1920x1080 or higher)
4. Rename if needed to match naming convention
5. Add to documentation or PR

---

## Questions?

See `CTA_FEATURES_SUMMARY.md` for full implementation details.
