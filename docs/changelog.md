# Changelog

All notable changes to YTgify will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned Features

- WebP format support for smaller file sizes
- Direct social media sharing
- Batch GIF creation
- Video trimming before GIF creation
- Custom watermarks (optional)
- Firefox extension support
- Cloud sync for settings
- Advanced filters and effects

## [1.0.3] - 2025-10-01

### Changed

- Updated extension description to "Turn your favorite YouTube moments into shareable GIFs." for improved marketing clarity

## [1.0.1] - 2025-09-24

### 🚀 Performance Improvements

#### Changed

- **Canvas Reuse Optimization**
  - Implemented canvas reuse instead of creating new canvases for every frame
  - Optimized GifJsEncoder to reuse regular canvas for gif.js compatibility
  - Enhanced ContentScriptGifProcessor with reusable main and recovery canvases
  - Improved memory efficiency and reduced garbage collection pressure
  - Better performance during GIF creation, especially for longer GIFs with many frames
  - Maintained full backward compatibility with all existing features

## [1.0.0] - 2025-01-09

### 🎉 Initial Release

#### Added

- **Core Features**
  - One-click GIF creation from YouTube videos
  - Visual timeline for precise clip selection
  - Real-time preview before creation
  - Integrated GIF button in YouTube player

- **Text Overlay System**
  - Single text overlay (top or bottom)
  - Dual text overlay for meme-style GIFs
  - Customizable fonts, colors, and sizes
  - Stroke/outline effects
  - Live preview of text overlays

- **Quality Settings**
  - Multiple quality presets (Fast, Balanced, High Quality)
  - Custom resolution options (240p to 1080p)
  - Adjustable frame rates (5-30 FPS)
  - Smart compression algorithms

- **Timeline Features**
  - Visual timeline scrubber
  - Frame-accurate selection
  - Zoom controls for precision
  - Keyboard navigation support
  - Maximum 30-second duration

- **GIF Library**
  - Automatic local storage of created GIFs
  - Search and filter capabilities
  - Grid view with thumbnails
  - Quick download and delete options
  - Storage management tools

- **User Interface**
  - Clean, modern design
  - Dark mode support
  - Responsive layouts
  - Smooth animations
  - Progress indicators

- **Keyboard Shortcuts**
  - Ctrl+Shift+G: Open GIF creator
  - Space: Play/pause
  - Arrow keys: Frame navigation
  - [/]: Set start/end points

- **Performance**
  - Web Worker processing
  - Efficient memory management
  - Optimized GIF encoding
  - Background processing support

- **Privacy**
  - Zero data collection
  - Local-only storage
  - No external connections
  - No analytics or tracking

#### Technical Details

- Built with TypeScript and React
- Manifest V3 compliance
- Chrome 88+ support
- Bundle size: 1.4MB
- Memory usage: ~15MB baseline

### Development Milestones

#### Pre-Release Development

- 2024-12: Project initiated
- 2025-01: Core functionality completed
- 2025-01: Text overlay feature added
- 2025-01: Timeline scrubber implemented
- 2025-01: Quality presets system
- 2025-01: GIF library management
- 2025-01: Phase 1 code quality improvements
- 2025-01: Security audit completed
- 2025-01: Performance optimization
- 2025-01: Documentation created

### Contributors

- Development Team
- Open Source Contributors (see GitHub)

### Acknowledgments

- gif.js library for GIF encoding
- React and TypeScript communities
- Beta testers and early users

---

## Version History Summary

| Version | Date       | Highlights                            |
| ------- | ---------- | ------------------------------------- |
| 1.0.3   | 2025-10-01 | Updated extension description         |
| 1.0.1   | 2025-09-24 | Canvas reuse optimization             |
| 1.0.0   | 2025-01-09 | Initial release with full feature set |

## Upgrade Guide

### From Development to 1.0.0

If you were using a development version:

1. Uninstall the development version
2. Install from Chrome Web Store
3. Your GIF library will be preserved
4. Settings will be migrated automatically

## Breaking Changes

None in initial release.

## Security Updates

None required in initial release.

## Known Issues

- Timeline scrubber may lag on very long videos (>2 hours)
- Some live streams may not work during active streaming
- Age-restricted videos are not supported (YouTube limitation)

## Reporting Issues

Please report bugs and request features on our [GitHub Issues](https://github.com/neonwatty/ytgify/issues) page.

---

_For more information, see the [User Guide](./user-guide.md) and [FAQ](./faq.md)._
