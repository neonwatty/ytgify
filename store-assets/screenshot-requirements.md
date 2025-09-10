# Chrome Web Store Screenshot Requirements

## Required Screenshots (1280x800 or 640x400)

### Screenshot 1: Hero Shot - GIF Button in YouTube Player
**Filename**: screenshot-1-hero.png
**Description**: "One-click GIF creation directly in YouTube player"
**Content**: 
- YouTube video playing
- GIF button prominently visible in player controls
- Clean, professional video content

### Screenshot 2: Timeline Selection Interface
**Filename**: screenshot-2-timeline.png
**Description**: "Visual timeline for precise moment selection"
**Content**:
- Timeline overlay active
- Selection handles visible
- Time markers and duration display
- Preview frames if possible

### Screenshot 3: Text Overlay Editor
**Filename**: screenshot-3-text-overlay.png
**Description**: "Add custom text overlays with professional styling options"
**Content**:
- Text overlay screen active
- Sample text entered (funny/engaging)
- Font and style options visible
- Live preview showing

### Screenshot 4: GIF Creation in Progress
**Filename**: screenshot-4-progress.png
**Description**: "Fast, efficient GIF encoding with real-time progress"
**Content**:
- Progress bar showing encoding
- Frame counter
- Estimated time remaining
- Professional UI

### Screenshot 5: GIF Library
**Filename**: screenshot-5-library.png
**Description**: "Manage your GIF collection with built-in library"
**Content**:
- Popup showing GIF library
- Multiple GIFs in grid view
- Search bar and filters
- Download/delete options visible

## Promotional Tile (Optional but Recommended)
**Size**: 440x280
**Filename**: promo-tile-small.png
**Content**:
- Extension logo/branding
- Tagline: "Transform YouTube into GIFs"
- Clean, eye-catching design
- YouTube + GIF visual elements

## Marquee Promotional Tile (Optional)
**Size**: 1400x560
**Filename**: promo-tile-marquee.png
**Content**:
- Wide banner format
- Feature highlights with icons
- Before/after or process flow
- Professional gradient background

## Screenshot Creation Guidelines

### General Requirements
1. Use high-quality, appropriate YouTube content
2. No copyrighted material visible
3. Clean browser UI (no personal bookmarks/tabs)
4. Professional color scheme
5. Clear, readable text
6. Show actual functionality

### Recommended Content
- Use YouTube's own creative commons videos
- Tech tutorials or educational content
- Public domain footage
- Nature/landscape videos
- Animation or motion graphics

### Avoid
- Personal information
- Inappropriate content
- Copyrighted movies/TV shows
- Political content
- Low-quality videos

## Screenshot Annotations

Consider adding subtle annotations:
- Arrow pointing to GIF button
- Highlight boxes around key features
- Step numbers (1, 2, 3) for workflow
- Feature callout bubbles

## Tools for Screenshot Creation

### Manual Method
1. Load extension in Chrome
2. Navigate to appropriate YouTube video
3. Use Chrome DevTools device emulation for exact sizes
4. Capture using screenshot tool
5. Edit in image editor if needed

### Automated Method (Playwright)
```javascript
// Create screenshot script in tests/generate-screenshots.js
const { chromium } = require('playwright');

async function generateScreenshots() {
  // Launch browser with extension
  const browser = await chromium.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`
    ]
  });
  
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  
  // Screenshot 1: Hero shot
  await page.goto('https://www.youtube.com/watch?v=[video-id]');
  await page.waitForSelector('.gif-button');
  await page.screenshot({ 
    path: 'store-assets/images/screenshot-1-hero.png' 
  });
  
  // Continue for other screenshots...
}
```

## Color Palette for Consistency

- Primary: #FF0000 (YouTube Red)
- Secondary: #282828 (YouTube Dark)
- Accent: #00D4FF (GIF Blue)
- Background: #FFFFFF or #0F0F0F
- Success: #00C853
- Text: #030303 or #FFFFFF

## File Organization

```
store-assets/
├── images/
│   ├── screenshot-1-hero.png
│   ├── screenshot-2-timeline.png
│   ├── screenshot-3-text-overlay.png
│   ├── screenshot-4-progress.png
│   ├── screenshot-5-library.png
│   ├── promo-tile-small.png
│   └── promo-tile-marquee.png
├── listing-content.md
└── screenshot-requirements.md
```

## Next Steps

1. Set up screenshot generation environment
2. Find appropriate YouTube videos for demos
3. Capture all required screenshots
4. Create promotional tiles
5. Optimize image sizes (keep under 1MB each)
6. Review for quality and consistency

## Quality Checklist

- [ ] All screenshots are 1280x800 or 640x400
- [ ] Images are clear and professional
- [ ] No personal information visible
- [ ] Features are clearly demonstrated
- [ ] Consistent visual style across all images
- [ ] File sizes optimized (< 1MB)
- [ ] Promotional tiles created (optional)
- [ ] All text is readable
- [ ] Color scheme is consistent
- [ ] No copyright violations