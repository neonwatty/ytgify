# Permission Justification Document

## YTgify Chrome Extension

---

## Overview

This document provides detailed justification for each permission requested by the YTgify Chrome Extension, ensuring transparency and compliance with Chrome Web Store policies.

---

## Requested Permissions

### 1. `storage`

**Purpose**: Store user preferences, settings, and GIF metadata

**Specific Usage**:

- User preferences (frame rate, quality, button visibility)
- GIF library metadata (creation date, duration, file size)
- Error reporting preferences
- Analytics settings (disabled by default for privacy)

**Files Using This Permission**:

- `src/background/index.ts` - User preferences management
- `src/popup/popup-modern.tsx` - Settings persistence
- `src/lib/chrome-gif-storage.ts` - GIF metadata storage
- `src/shared/logger.ts` - Analytics preferences
- `src/storage/chrome-storage.ts` - Storage abstraction layer

**Data Stored**:

- Settings: Quality presets, frame rates, output dimensions
- User preferences: Button visibility, keyboard shortcuts
- GIF metadata: Creation timestamps, video URLs (for re-editing)
- No personal information or tracking data

---

### 2. `tabs`

**Purpose**: Query active tab and send messages between extension contexts

**Specific Usage**:

- Query active tab to check if it's a YouTube page
- Send messages to content script for GIF processing
- Create new YouTube tabs when needed
- Update tab URLs for navigation

**Files Using This Permission**:

- `src/background/index.ts` - Tab management and messaging
- `src/background/message-handler.ts` - Inter-context communication
- `src/popup/popup-modern.tsx` - Check current tab URL
- `src/shared/message-bus.ts` - Broadcast messages to tabs

**Security Note**: Only accesses tab metadata (URL, ID) and sends structured messages. Does not read tab content directly.

---

### 3. `activeTab`

**Purpose**: Access current YouTube tab for GIF creation

**Specific Usage**:

- Inject content script into active YouTube tab
- Extract video frames for GIF processing
- Access YouTube video metadata (title, duration)
- Insert GIF creation UI elements

**Security Note**: Only activated when user clicks extension icon or uses keyboard shortcut. Provides minimal necessary access to current tab only.

---

### 4. `scripting`

**Purpose**: Inject content script into YouTube pages

**Specific Usage**:

- Inject main content script (`content.js`) into YouTube pages
- Add GIF creation button to YouTube player controls
- Insert timeline overlay for segment selection
- Provide video frame extraction capabilities

**Files Using This Permission**:

- Manifest declares content script injection
- Background service worker manages script execution

**Security Note**: Only injects into YouTube domains (`https://*.youtube.com/*`). Scripts are bundled with extension, not loaded remotely.

---

### 5. `clipboardWrite`

**Purpose**: Copy created GIFs to clipboard

**Specific Usage**:

- Copy GIF blob data to system clipboard
- Allow users to paste GIFs directly into other applications
- Provide quick sharing functionality

**User Benefit**: Enables seamless sharing workflow - create GIF → copy → paste into chat/email/social media.

**Security Note**: Only writes data that the user explicitly created. Does not read from clipboard.

---

### 6. `downloads`

**Purpose**: Save GIFs to user's computer

**Specific Usage**:

- Download generated GIF files to user's Downloads folder
- Save with descriptive filenames (e.g., "youtube_gif_2025_01_09.gif")
- Respect user's download folder preferences

**Security Note**: Only downloads files that the user explicitly created. Uses standard browser download API.

---

## Host Permissions

### `https://*.youtube.com/*`

**Purpose**: Enable extension functionality on YouTube

**Specific Usage**:

- Inject content scripts into YouTube pages
- Access YouTube player for video frame extraction
- Monitor for Single Page Application (SPA) navigation
- Add UI elements to YouTube interface

**Scope**:

- Includes all YouTube subdomains (www, m, music, etc.)
- Required for content script injection
- Enables YouTube API integration

**Security Note**: Extension only activates on YouTube. Does not access other websites.

---

## Permission Minimization

### Why We Don't Request:

- **Host permission for all sites**: Only works on YouTube
- **Cookies**: No tracking or user identification needed
- **History**: No need to access browsing history
- **Bookmarks**: Functionality doesn't require bookmark access
- **Management**: No need to manage other extensions
- **Privacy**: No need to access privacy settings
- **WebRequest**: No need to intercept network requests

### Privacy-First Design:

- All permissions are functionally necessary
- No data collection or analytics by default
- All processing happens locally
- No external API calls or data transmission

---

## User Communication

### Store Listing Description:

"This extension requires the following permissions to create GIFs from YouTube videos:

- Storage: Save your preferences and created GIFs
- Active Tab: Access the YouTube video you're watching
- Downloads: Save GIFs to your computer
- Clipboard: Copy GIFs for easy sharing
- YouTube Access: Add GIF creation tools to YouTube pages

All processing happens locally on your device. No data is collected or transmitted."

---

## Compliance Statement

All requested permissions are:

1. **Necessary**: Required for core functionality
2. **Minimal**: Only what's needed, nothing more
3. **Transparent**: Clearly documented and justified
4. **Secure**: No unnecessary access to sensitive data
5. **Privacy-Respectful**: No tracking or data collection

---

_Last Updated: January 9, 2025_
_Extension Version: 1.0.0_
