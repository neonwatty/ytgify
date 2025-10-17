# Marketing CTA Mockups

ASCII mockups for non-intrusive marketing call-to-action components.

---

## 1. Success Screen - Permanent Share Link

Appears at bottom of Success Screen after user creates a GIF. Always visible, no qualification required.

```
┌─────────────────────────────────────────────────────────────┐
│                   GIF Created Successfully!                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                                                         │  │
│  │                 [GIF Preview Image]                     │  │
│  │                  480×360 • 2.4 MB                       │  │
│  │                    3.5s • 30 frames                     │  │
│  │                                                         │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│                    Your GIF is ready!                        │
│                                                               │
│         ◄ Back                    Download GIF ►             │
│                                                               │
│     Give Feedback     🔗 Spread the word about YTGify       │
└─────────────────────────────────────────────────────────────┘
```

**Design Notes:**
- "Spread the word about YTGify" is permanent link, always visible
- Positioned next to "Give Feedback" at bottom of screen
- Icon + text styling (share icon with label)
- Clicking opens Twitter with pre-filled tweet (uses short template from Section 6)
- No qualification logic or conditional rendering
- Secondary action styling - less prominent than main buttons

---

## 2. Milestone Celebration Screen

Triggered at 10, 25, 50 GIFs (replaces Success Screen at these exact moments).

### Milestone: 10 GIFs

```
┌─────────────────────────────────────────────────────────────┐
│                        Milestone!                            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│                                                               │
│                   You've created 10 GIFs!                    │
│                                                               │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                                                       │    │
│  │         Help others discover YTGify too!             │    │
│  │                                                       │    │
│  │   ┌──────────────┐ ┌──────────────┐ ┌────────────┐ │    │
│  │   │   ⭐ Rate    │ │  Share on X  │ │  ⭐ Star   │ │    │
│  │   │  Extension   │ │              │ │   GitHub   │ │    │
│  │   └──────────────┘ └──────────────┘ └────────────┘ │    │
│  │                                                       │    │
│  └───────────────────────────────────────────────────────   │
│                                                               │
│                        Maybe Later                           │
│                                                               │
│                       Continue ►                             │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Milestone: 25 GIFs

```
┌─────────────────────────────────────────────────────────────┐
│                      Amazing Work!                           │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│                                                               │
│                   You've created 25 GIFs!                    │
│                                                               │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                                                       │    │
│  │    You're a GIF master! Spread the word about        │    │
│  │               YTGify to fellow creators               │    │
│  │                                                       │    │
│  │   ┌──────────────┐ ┌──────────────┐ ┌────────────┐ │    │
│  │   │   ⭐ Rate    │ │  Share on X  │ │  ⭐ Star   │ │    │
│  │   │  Extension   │ │              │ │   GitHub   │ │    │
│  │   └──────────────┘ └──────────────┘ └────────────┘ │    │
│  │                                                       │    │
│  └───────────────────────────────────────────────────────   │
│                                                               │
│                        Not Now                               │
│                                                               │
│                       Continue ►                             │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Milestone: 50 GIFs

```
┌─────────────────────────────────────────────────────────────┐
│                    Legendary Creator!                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│                                                               │
│                   You've created 50 GIFs!                    │
│                                                               │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                                                       │    │
│  │   You're in the top tier! Help YTGify grow by        │    │
│  │      sharing your experience with the world           │    │
│  │                                                       │    │
│  │   ┌──────────────┐ ┌──────────────┐ ┌────────────┐ │    │
│  │   │   ⭐ Rate    │ │  Share on X  │ │  ⭐ Star   │ │    │
│  │   │  Extension   │ │              │ │   GitHub   │ │    │
│  │   └──────────────┘ └──────────────┘ └────────────┘ │    │
│  │                                                       │    │
│  └───────────────────────────────────────────────────────   │
│                                                               │
│                      I'll Pass                               │
│                                                               │
│                       Continue ►                             │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**Design Notes:**
- Replaces standard Success Screen at exact milestone counts
- Escalating enthusiasm at each tier (10/25/50)
- Same 3 action buttons
- Different dismiss text for variety
- After dismissing, returns to standard GIF workflow

---

## 3. Popup Footer Enhancement

Appears at bottom of popup (only if qualified: 10+ GIFs, 14+ days).

### Current Popup (without footer):

```
┌────────────────────────────────────────┐
│  🎬 YTGify                             │
│  GIF your favorite YouTube moments     │
├────────────────────────────────────────┤
│  ☐ Pin YTGify button to player   OFF  │
├────────────────────────────────────────┤
│                                        │
│  Capture GIF moments from:             │
│  "Amazing Cat Video Compilation"       │
│                                        │
│        [ Create GIF ]                  │
│                                        │
│    Ctrl + Shift + G  Quick access      │
│                                        │
└────────────────────────────────────────┘
```

### Enhanced Popup (with footer):

```
┌────────────────────────────────────────┐
│  🎬 YTGify                             │
│  GIF your favorite YouTube moments     │
├────────────────────────────────────────┤
│  ☐ Pin YTGify button to player   OFF  │
├────────────────────────────────────────┤
│                                        │
│  Capture GIF moments from:             │
│  "Amazing Cat Video Compilation"       │
│                                        │
│        [ Create GIF ]                  │
│                                        │
│    Ctrl + Shift + G  Quick access      │
│                                        │
├────────────────────────────────────────┤
│ Enjoying YTGify? Rate us | Share | ⭐ │×
└────────────────────────────────────────┘
```

**Design Notes:**
- Single line footer, 11px font
- Muted text color (#666)
- Text links (underline on hover)
- Small × dismiss in corner
- Dismissible permanently
- Links: "Rate us" → Web Store, "Share" → opens share dialog, "⭐" → GitHub

**Footer States:**

Dismissed:
```
┌────────────────────────────────────────┐
│  🎬 YTGify                             │
│  GIF your favorite YouTube moments     │
├────────────────────────────────────────┤
│  ☐ Pin YTGify button to player   OFF  │
├────────────────────────────────────────┤
│                                        │
│  Capture GIF moments from:             │
│  "Amazing Cat Video Compilation"       │
│                                        │
│        [ Create GIF ]                  │
│                                        │
│    Ctrl + Shift + G  Quick access      │
│                                        │
└────────────────────────────────────────┘
```

---

## 4. Enhanced Feedback Screen

Add "Show Your Support" section to existing Feedback screen.

### Current Feedback Screen:

```
┌─────────────────────────────────────────────────────────────┐
│                    Help Us Improve YTGify                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│                        [YTGify Logo]                         │
│                                                               │
│              Found a bug or have a feature request?          │
│                    We'd love to hear from you!               │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Report Issues & Request Features                    │    │
│  │  Visit our GitHub repository to report bugs or       │    │
│  │  suggest new features:                                │    │
│  │                                                       │    │
│  │  ┌───────────────────────────────────────────────┐  │    │
│  │  │  [GitHub Icon]  GitHub Issues                 │  │    │
│  │  └───────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Follow & Connect                                     │    │
│  │  Follow us on X for updates and quick questions:     │    │
│  │                                                       │    │
│  │  ┌───────────────────────────────────────────────┐  │    │
│  │  │  [X Icon]  @neonwatty                         │  │    │
│  │  └───────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│         ◄ Back                          Done                 │
└─────────────────────────────────────────────────────────────┘
```

### Enhanced Feedback Screen:

```
┌─────────────────────────────────────────────────────────────┐
│                    Help Us Improve YTGify                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│                        [YTGify Logo]                         │
│                                                               │
│              Found a bug or have a feature request?          │
│                    We'd love to hear from you!               │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Report Issues & Request Features                    │    │
│  │  Visit our GitHub repository to report bugs or       │    │
│  │  suggest new features:                                │    │
│  │                                                       │    │
│  │  ┌───────────────────────────────────────────────┐  │    │
│  │  │  [GitHub Icon]  GitHub Issues                 │  │    │
│  │  └───────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Show Your Support                                    │    │
│  │  Love YTGify? Help us grow:                          │    │
│  │                                                       │    │
│  │  ┌────────────────────┐  ┌────────────────────────┐ │    │
│  │  │  ⭐ Rate YTGify    │  │  ⭐ Star on GitHub     │ │    │
│  │  │  Chrome Web Store  │  │  Show your support     │ │    │
│  │  └────────────────────┘  └────────────────────────┘ │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Follow & Connect                                     │    │
│  │  Follow us on X for updates and quick questions:     │    │
│  │                                                       │    │
│  │  ┌───────────────────────────────────────────────┐  │    │
│  │  │  [X Icon]  @neonwatty                         │  │    │
│  │  └───────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│         ◄ Back                          Done                 │
└─────────────────────────────────────────────────────────────┘
```

**Design Notes:**
- New section inserted between GitHub Issues and Follow sections
- Two side-by-side buttons
- "Rate YTGify" → Chrome Web Store review page
- "Star on GitHub" → GitHub repo stars page (more prominent than existing link)
- No qualification check - always visible (user chose to give feedback)
- Same visual style as existing sections

---

## 5. Social Share Dialog

Triggered when user clicks "Share on X" button.

### Share Dialog Overlay:

```
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│                                                               │
│     ┌───────────────────────────────────────────────────┐   │
│     │  Share YTGify                                   ×  │   │
│     ├───────────────────────────────────────────────────┤   │
│     │                                                    │   │
│     │  Copy a pre-written message to share:            │   │
│     │                                                    │   │
│     │  ┌────────────────────────────────────────────┐  │   │
│     │  │  [Twitter/X Icon]                          │  │   │
│     │  │  Share on X                                │  │   │
│     │  │                                            │  │   │
│     │  │  "Just made amazing GIFs from YouTube     │  │   │
│     │  │   with YTGify! Free, open-source, and     │  │   │
│     │  │   super easy to use."                      │  │   │
│     │  │                                            │  │   │
│     │  │           [ Open X with Tweet ]            │  │   │
│     │  └────────────────────────────────────────────┘  │   │
│     │                                                    │   │
│     │  ┌────────────────────────────────────────────┐  │   │
│     │  │  [Copy Icon]                               │  │   │
│     │  │  Copy Link                                 │  │   │
│     │  │                                            │  │   │
│     │  │  https://chrome.google.com/webstore/...   │  │   │
│     │  │                                            │  │   │
│     │  │           [ Copy to Clipboard ]            │  │   │
│     │  └────────────────────────────────────────────┘  │   │
│     │                                                    │   │
│     │  ┌────────────────────────────────────────────┐  │   │
│     │  │  [Message Icon]                            │  │   │
│     │  │  Copy Message                              │  │   │
│     │  │                                            │  │   │
│     │  │  "Check out YTGify - create GIFs from     │  │   │
│     │  │   YouTube videos instantly!"               │  │   │
│     │  │                                            │  │   │
│     │  │           [ Copy Message ]                 │  │   │
│     │  └────────────────────────────────────────────┘  │   │
│     │                                                    │   │
│     │                      Close                        │   │
│     │                                                    │   │
│     └────────────────────────────────────────────────────   │
│                                                               │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**Design Notes:**
- Modal overlay (dimmed background)
- Three options: Direct X post, copy link, copy message
- "Open X with Tweet" opens new tab with pre-filled tweet
- Copy actions provide visual feedback ("Copied!")
- Multiple message variations to choose from
- Link placeholder until extension is live on Web Store

### Copy Feedback Animation:

```
     │  │           [ ✓ Copied! ]                       │  │
```

---

## 6. Pre-filled Social Messages

### Twitter/X Messages:

**Short (280 chars max):**
```
Just made awesome GIFs from YouTube with YTGify! 🎬✨
Free, open-source, and super easy to use.
[Chrome Web Store Link]
```

**Medium:**
```
Loving YTGify for creating GIFs from YouTube!

✨ One-click GIF creation
🎨 Add text overlays
📚 Built-in library
🔒 Privacy-first

Free & open-source: [Link]
```

**Long:**
```
Found the perfect Chrome extension for making GIFs from YouTube!

YTGify lets you:
• Create GIFs directly from videos
• Add custom text overlays
• Save to a personal library
• No uploads, no watermarks

Plus it's free and open-source! [Link]
```

### Discord/Slack Message:
```
Check out YTGify - it makes creating GIFs from YouTube super easy!
No downloads, no sign-ups, just click and create.
[Chrome Web Store Link]
```

### Reddit-style Post:
```
[Extension] YTGify - Create GIFs from YouTube with text overlays

I've been using this extension to make GIFs from YouTube videos.
It's free, open-source, and works entirely in your browser.
Features include text overlays, custom quality settings, and a
built-in library. No sign-ups or watermarks.

[Chrome Web Store Link]
[GitHub Link]
```

---

## Visual Design System

### Colors
- Primary CTA Button: `#FF0000` (YouTube Red)
- Secondary Button: `#F0F0F0` (Light Gray)
- Border: `#E0E0E0`
- Muted Text: `#666666`
- Dismiss Link: `#888888`
- Success Green: `#4CAF50`

### Typography
- Milestone Title: 24px, bold
- Section Headers: 16px, semi-bold
- Body Text: 14px, regular
- Footer Text: 11px, regular
- Button Text: 14px, medium

### Spacing
- Card Padding: 20px
- Button Height: 40px
- Section Margin: 16px
- Footer Height: 32px

### Animations
- Button Hover: 0.2s ease
- Copy Feedback: 1.5s fade-out

---

## Implementation Priority

1. **Phase 1 (Core):**
   - Engagement tracker
   - Success Screen share link
   - Social templates

2. **Phase 2 (Enhancement):**
   - Milestone screens
   - Popup footer
   - Share dialog

3. **Phase 3 (Polish):**
   - Enhanced Feedback screen
   - Copy feedback animations
