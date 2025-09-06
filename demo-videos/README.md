# YouTube GIF Maker - Demo Videos

This directory contains automated demo videos of the YouTube GIF Maker Chrome extension in action.

## 📹 Available Demos

### 1. Full Demo (`create-demo-video.spec.js`)
A comprehensive demonstration showing:
- Loading a YouTube video
- Opening the GIF editor
- Selecting time duration
- Adjusting quality settings
- Setting frame rate
- Choosing resolution
- Creating the GIF
- Monitoring progress
- Exporting the final GIF

### 2. Annotated Demo (`create-demo-video-annotated.spec.js`)
An enhanced demo with:
- On-screen annotations for each step
- Visual highlighting of UI elements
- Step-by-step instructions
- Progress indicators

## 🎬 Recording New Demos

To record a new demo video:

```bash
# Run the basic demo
npx playwright test tests/create-demo-video.spec.js --headed

# Run the annotated demo
npx playwright test tests/create-demo-video-annotated.spec.js --headed
```

## 🔄 Converting to MP4

The demos are recorded in WebM format. To convert to MP4:

```bash
# Make sure ffmpeg is installed
brew install ffmpeg  # macOS
# or
sudo apt-get install ffmpeg  # Ubuntu

# Run the conversion script
./convert-demo-video.sh
```

The MP4 files will be saved in `demo-videos-mp4/` directory.

## 📊 Video Specifications

- **Resolution**: 1920x1080 (Full HD)
- **Format**: WebM (VP8/VP9) or MP4 (H.264)
- **Frame Rate**: 30 fps
- **Duration**: ~1 minute

## 🚀 Using the Videos

These demo videos can be used for:
- Documentation and tutorials
- GitHub README showcases
- Product demonstrations
- Bug reports and feature requests
- Marketing materials

## 📝 Customization

To customize the demo recordings, edit the test files:
- Adjust timing with `pause()` function
- Modify annotation text and styles
- Change the test video URL
- Select different quality settings
- Add more interaction steps

## 🎯 Tips for Best Results

1. **Clean Environment**: Close unnecessary tabs and applications
2. **Stable Network**: Ensure good internet connection for smooth video loading
3. **Fresh Build**: Run `npm run build` before recording
4. **Full Screen**: Maximize the browser window for best visibility
5. **Multiple Takes**: Record multiple times and choose the best one

## 📁 File Structure

```
demo-videos/
├── README.md                 # This file
├── *.webm                   # Raw recordings from Playwright
└── demo-videos-mp4/         # Converted MP4 files (after running convert script)
    └── ytgiphy-demo.mp4    # Main demo video
```

## 🔧 Troubleshooting

- **Video not recording**: Ensure `recordVideo` option is enabled in test
- **Poor quality**: Increase video resolution in recording settings
- **Missing UI elements**: Wait for extension to fully load before recording
- **Conversion fails**: Check ffmpeg installation and video codec support