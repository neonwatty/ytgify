# YouTube GIF Maker Chrome Extension - Product Requirements Document

## Overview
A Chrome extension that enables users to create GIFs directly from YouTube videos with an intuitive visual interface integrated into the YouTube player.

## Core Features

### 1. Timeline Overlay Integration
- **Integrated GIF button**: Added to YouTube's video player control bar, positioned between existing controls (e.g., next to settings/caption buttons)
- **GIF Mode activation**: Clicking the button activates a semi-transparent overlay on YouTube's progress bar
- **Visual segment selection**: Draggable start/end markers directly on the timeline
- **Real-time feedback**: Display selected duration (e.g., "3.5 seconds selected")

### 2. Selection Method
- **Visual scrubbing**: Click and drag on timeline to select range
- Clear visual indicators for start and end points
- Ability to fine-tune selection by dragging individual markers

### 3. GIF Editor Interface
After segment selection, a modal or sidebar opens with:

#### Live Preview
- Real-time preview of the GIF loop
- Play/pause controls for preview

#### Basic Controls
- **Frame rate slider**: 5-30 fps
- **Quality/size options**: Balance between quality and file size
- **Resolution settings**: Original, 720p, 480p, 360p

#### Text Overlay Tools
- Drag-and-drop text positioning
- Font selection, size, and color options
- Basic animation effects (fade in/out, static)
- Multiple text layers support

#### Visual Adjustments
- Brightness and contrast sliders
- Playback speed multiplier (0.5x - 2x)
- Crop tool for focusing on specific areas

### 4. Export & Save Options
- Save to personal library (browser storage)
- Download as GIF file
- Copy to clipboard
- File size preview before export

### 5. GIF Library
A personal collection of all created GIFs stored locally in the browser.

#### Library Features
- **Grid view**: Thumbnail previews of all saved GIFs
- **Search & filter**: 
  - Search by video title or custom tags
  - Filter by date created
  - Sort by most recent, file size, or alphabetical
- **GIF metadata**: 
  - Source video title and URL
  - Creation date
  - File size
  - Custom tags/labels
- **Management tools**:
  - Re-edit saved GIFs
  - Delete individual or bulk GIFs
  - Export/import library for backup
  - Storage usage indicator

#### Library Access
- Dedicated library button in extension popup
- Quick access from editor after creating a GIF
- Optional: Library tab integrated into YouTube interface

## User Workflows

### Primary Workflow: Creating a GIF from a Moment

1. **Discovery**
   - User watches a YouTube video
   - Notices an interesting moment they want to capture

2. **Activation**
   - User locates GIF button in the video player controls (styled to match YouTube's native buttons)
   - User clicks the GIF button

3. **Selection**
   - Timeline overlay appears over YouTube's progress bar
   - User clicks on timeline at desired start point
   - Drags to desired end point
   - Markers appear showing selected range
   - Duration indicator shows "X seconds selected"

4. **Refinement**
   - User can drag individual start/end markers to fine-tune
   - Video automatically loops the selected segment for preview

5. **Editing**
   - Editor panel slides in from the right
   - User sees live preview of GIF at top
   - Adjusts frame rate using slider
   - (Optional) Adds text overlay by clicking "Add Text"
   - (Optional) Adjusts brightness/contrast if needed
   - (Optional) Crops to focus on specific area

6. **Save & Export**
   - User adds optional tags for organization
   - Clicks "Save to Library" to store in browser
   - Can also download or copy to clipboard
   - Success notification confirms save

### Secondary Workflow: Quick Capture

1. User pauses video at interesting moment
2. Clicks GIF button in player controls
3. Uses quick preset "Last 5 seconds"
4. Saves directly to library with auto-generated metadata

### Tertiary Workflow: Managing GIF Library

1. User clicks extension icon in Chrome toolbar
2. Selects "My GIF Library"
3. Browses saved GIFs in grid view
4. Can:
   - Click GIF to view full size
   - Re-edit a previously created GIF
   - Add/edit tags for better organization
   - Download selected GIFs
   - Delete unwanted GIFs
   - Search for specific GIFs by video title or tags

### Quaternary Workflow: Re-editing Saved GIF

1. User opens GIF library
2. Finds previously created GIF
3. Clicks "Edit" button
4. Editor reopens with saved settings
5. Makes adjustments (new text, different crop, etc.)
6. Saves as new version or replaces original

## Technical Architecture

### Core Components

#### Content Script
- Injects GIF button into YouTube player controls
- Monitors video player state
- Handles timeline overlay interactions
- Manages communication with background script

#### Background Worker
- Handles video frame extraction
- Processes GIF encoding
- Manages temporary storage
- Handles library operations

#### Editor Interface
- React-based component system
- Real-time preview rendering
- Canvas-based frame manipulation

#### Library Manager
- IndexedDB for GIF storage
- Metadata management system
- Search and filter functionality
- Storage quota monitoring

### Key Technologies
- **WebCodecs API**: Efficient video frame extraction
- **Canvas API**: Frame manipulation and text overlay
- **gif.js**: Client-side GIF encoding
- **IndexedDB**: GIF library and metadata storage
- **Chrome Storage API**: User preferences and settings
- **Blob Storage**: Efficient GIF data storage
- **shadcn/ui**: Modern React component library for UI elements
- **Tailwind CSS**: Utility-first CSS framework for styling
- **Radix UI**: Accessible component primitives (via shadcn)

### UI Component Library (shadcn/ui)
The extension will leverage shadcn/ui components for a modern, consistent interface:

#### Editor Components
- **Dialog**: Main editor modal container
- **Tabs**: Organize editor sections (Basic, Text, Effects)
- **Slider**: Frame rate, brightness, contrast controls
- **Select**: Resolution and quality dropdowns
- **Input**: Text overlay content entry
- **Button**: Consistent action buttons throughout
- **Toggle**: Settings switches (auto-loop, etc.)
- **Progress**: GIF encoding progress indicator
- **ColorPicker** (via Popover): Text color selection

#### Library Components
- **Card**: Individual GIF items in grid
- **ScrollArea**: Scrollable library container
- **Badge**: Tags and metadata labels
- **DropdownMenu**: GIF action menus
- **AlertDialog**: Confirmation for deletions
- **Toast**: Success/error notifications
- **Tooltip**: Helpful UI hints

#### Timeline Components
- Custom-built scrubber using shadcn design tokens
- Styled to blend seamlessly with YouTube's player

### Data Storage Structure
```javascript
{
  gifId: "unique-id",
  gifData: Blob, // The actual GIF file
  metadata: {
    videoTitle: "Original YouTube Video Title",
    videoUrl: "https://youtube.com/watch?v=...",
    videoThumbnail: "thumbnail-url",
    createdAt: Date,
    fileSize: Number,
    duration: Number,
    frameRate: Number,
    resolution: String,
    tags: Array<String>,
    settings: Object // Editor settings for re-editing
  }
}
```

## Design Principles

### Visual Design
- **Native integration**: GIF button styled to match YouTube's player controls exactly
- **Modern component design**: shadcn/ui provides consistent, accessible components
- **Glassmorphism**: Semi-transparent overlays that don't obstruct video
- **Minimal interference**: UI elements appear only when needed
- **Dark/light mode**: Automatically matches YouTube's theme via Tailwind
- **Smooth animations**: All transitions under 300ms using Tailwind animations

### Usability
- **One-click activation**: Single button to start GIF creation
- **Visual feedback**: Clear indicators for all actions
- **Progressive disclosure**: Advanced features hidden until needed
- **Responsive**: Works on different screen sizes and video dimensions
- **Persistent storage**: GIFs remain available across browser sessions
- **Keyboard accessibility**: Full keyboard navigation support via Radix UI

## Performance Requirements
- Frame extraction: < 100ms per frame
- GIF encoding: < 5 seconds for 5-second clip at 15fps
- UI responsiveness: All interactions < 50ms response time
- Memory usage: < 500MB during processing
- Library loading: < 1 second for 100 GIFs
- Storage efficiency: Compression for stored GIFs

## Storage Limits
- Default storage quota: 500MB
- User warning at 80% capacity
- Option to export library before clearing space
- Automatic cleanup of oldest GIFs (with user permission)

## Browser Compatibility
- Chrome 100+
- Edge 100+
- Support for Manifest V3

## Success Metrics
- Time from activation to export: < 30 seconds for basic GIF
- User can create GIF without leaving YouTube page
- File sizes optimized (< 5MB for 5-second GIF at standard quality)
- Zero impact on YouTube playback performance when inactive
- Library can store 100+ GIFs without performance degradation
- Users successfully retrieve and re-use saved GIFs

## Future Considerations (Out of Scope for V1)
- Cloud sync for library across devices
- AI-powered smart moment detection
- Batch processing multiple GIFs
- WebP and MP4 export options
- Social media direct sharing
- Templates and preset styles
- Collaborative libraries/sharing with others