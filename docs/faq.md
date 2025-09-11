# Frequently Asked Questions (FAQ)

## General Questions

### What is YouTube GIF Maker?
YouTube GIF Maker is a Chrome extension that lets you create high-quality GIFs directly from YouTube videos without downloading or uploading anything. It works right in your browser with a simple, integrated interface.

### Is it free to use?
Yes! YouTube GIF Maker is completely free with no hidden costs, subscriptions, or premium features. All functionality is available to all users.

### Do I need to create an account?
No account needed! The extension works immediately after installation with no sign-up, login, or personal information required.

### What browsers are supported?
Currently, the extension supports:
- Google Chrome (version 88+)
- Microsoft Edge (Chromium-based)
- Brave Browser
- Other Chromium-based browsers

Firefox support is planned for a future release.

## Privacy & Security

### Do you collect my data?
**No.** We don't collect, store, or transmit any personal data. All GIFs are created and stored locally on your device. We have no servers, no analytics, and no tracking.

### Where are my GIFs stored?
GIFs are stored locally in your browser using IndexedDB and Chrome's storage API. They never leave your device unless you explicitly download or share them.

### Can you see what videos I make GIFs from?
No. We have no visibility into your usage. The extension runs entirely on your device with no external connections.

### Is it safe to use?
Yes! The extension is:
- Open source (code available on GitHub)
- Reviewed by Google for the Chrome Web Store
- Uses only necessary permissions
- Contains no malware or tracking

## Usage Questions

### How do I create a GIF?
1. Go to any YouTube video
2. Click the GIF button in the player controls
3. Select your clip using the timeline
4. Click "Create GIF"
That's it!

### What's the maximum GIF duration?
The default maximum is 30 seconds, though we recommend keeping GIFs under 10 seconds for optimal file size and performance.

### Can I add text to my GIFs?
Yes! You can add:
- Single text overlays (top or bottom)
- Dual text overlays (meme style)
- Custom fonts, colors, and sizes
- Stroke/outline effects

### What quality options are available?
- **Resolutions**: 240p to 1080p
- **Frame rates**: 5 to 30 FPS
- **Presets**: Fast, Balanced, High Quality, Custom
- **File formats**: GIF (WebP support coming soon)

### Can I edit GIFs after creating them?
Currently, you cannot edit existing GIFs, but you can:
- Create a new version with different settings
- Delete unwanted GIFs
- Save multiple versions

## Technical Questions

### Why isn't the GIF button showing?
Try these solutions:
1. Refresh the YouTube page (F5)
2. Check if the extension is enabled in Chrome
3. Disable other YouTube extensions temporarily
4. Clear your browser cache
5. Reinstall the extension

### Why did GIF creation fail?
Common reasons:
- Video is age-restricted or private
- Video hasn't fully loaded
- Duration is too long (over 30 seconds)
- Browser ran out of memory (try lower quality)
- Network issues during video loading

### Why is my GIF quality poor?
To improve quality:
- Use the "High Quality" preset
- Increase resolution (720p or 1080p)
- Increase frame rate (20+ FPS)
- Ensure source video is HD
- Check your timeline selection

### Why are my GIFs so large?
To reduce file size:
- Lower the resolution (360p-480p)
- Reduce frame rate (10-15 FPS)
- Shorten the duration
- Use the "Fast" preset
- Enable optimization in settings

### The extension is slow. How can I speed it up?
- Use lower resolution settings
- Reduce frame rate
- Create shorter GIFs
- Close other tabs to free memory
- Use the "Fast" quality preset

## Limitations

### What videos work with the extension?
Works with:
- Public YouTube videos
- Unlisted videos (if you have the link)
- Your own uploaded videos
- YouTube Shorts
- Live streams (recorded portions)

Doesn't work with:
- Age-restricted videos
- Private videos
- YouTube Music (DRM protected)
- Paid/rental content
- Some embedded videos

### Are there file size limits?
- No hard limit set by the extension
- Browser memory limits apply (~2GB)
- Recommended max: 50MB for sharing
- Use lower quality for large GIFs

### Can I use this for commercial purposes?
The extension itself is free for any use, but:
- Respect YouTube's Terms of Service
- Respect video creators' copyrights
- Don't use copyrighted content commercially
- Check video licenses before commercial use

## Features

### Can I save GIFs to my computer?
Yes! Every GIF can be downloaded to your computer using the download button in the library or immediately after creation.

### Can I share GIFs directly to social media?
Direct sharing is coming soon. Currently, you can:
1. Download the GIF
2. Upload to your preferred platform
3. Or use the copy link feature for sharing

### Is there a batch/bulk creation feature?
Not yet, but it's on our roadmap. Currently, GIFs are created one at a time for optimal performance.

### Can I create GIFs from other video sites?
Currently only YouTube is supported. Support for other platforms may be added based on user demand.

### Can I remove the watermark?
There is no watermark! All GIFs are created clean without any branding.

## Troubleshooting

### The extension stopped working after an update
1. Clear your browser cache
2. Restart Chrome
3. Disable and re-enable the extension
4. If issues persist, reinstall the extension

### My GIF library disappeared
Check if:
1. You're using the same Chrome profile
2. You haven't cleared browser data
3. The extension wasn't reinstalled
4. Storage permissions are enabled

### Keyboard shortcuts aren't working
1. Check for conflicts with other extensions
2. Ensure YouTube tab is active/focused
3. Try resetting shortcuts in settings
4. Some shortcuts may not work in fullscreen

### The timeline scrubber is not accurate
- Let the video fully buffer first
- Try using arrow keys for precise control
- Use a lower playback speed for accuracy
- Report persistent issues on GitHub

## Support

### How do I report a bug?
1. Go to our [GitHub Issues](https://github.com/neonwatty/ytgiphy/issues)
2. Check if the issue already exists
3. Create a new issue with:
   - Description of the problem
   - Steps to reproduce
   - Browser version
   - Screenshot if applicable

### How do I request a feature?
Same as bug reports - create an issue on GitHub with the "enhancement" label.

### Is there a community or forum?
Currently, GitHub Discussions is our community hub. Join us there for help, tips, and conversations.

### How often is the extension updated?
We release updates regularly:
- Bug fixes: As needed (usually within days)
- Features: Monthly releases
- Security: Immediate patches if needed

### Can I contribute to the project?
Yes! We welcome contributions:
- Code contributions via pull requests
- Bug reports and feature requests
- Documentation improvements
- Translations (coming soon)

## Legal

### Is this extension official/affiliated with YouTube?
No. This is an independent extension not affiliated with, endorsed by, or sponsored by YouTube or Google.

### What about copyright?
Users are responsible for respecting copyright:
- Only create GIFs from content you have rights to use
- Respect creators' rights
- Follow fair use guidelines
- Don't monetize copyrighted content

### Do you guarantee the extension will always work?
While we strive for reliability, we cannot guarantee uninterrupted service as YouTube may change their platform at any time.

---

**Still have questions?** Open an issue on [GitHub](https://github.com/neonwatty/ytgiphy/issues) or check our [User Guide](./user-guide.md).