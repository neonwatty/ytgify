interface TwitterTemplate {
  label: string;
  text: string;
}

// Twitter/X Templates
export function getTwitterTemplates(): TwitterTemplate[] {
  return [
    {
      label: 'Short',
      text: 'Just discovered YTGify - the easiest way to create GIFs from YouTube videos! No downloads, no ads, works right in your browser.'
    },
    {
      label: 'Medium',
      text: 'YTGify is amazing! Create high-quality GIFs from YouTube videos instantly. Add text overlays, adjust quality, and save to your library. All without leaving YouTube!'
    },
    {
      label: 'Long',
      text: 'YTGify is the Chrome extension I didn\'t know I needed! Create GIFs from YouTube videos with custom text overlays, multiple quality settings, and a built-in library. Privacy-focused and completely free. Check it out!'
    }
  ];
}

// Discord/Slack Template
export function getDiscordTemplate(): string {
  return `Check out YTGify - a Chrome extension for creating GIFs from YouTube videos!

Features:
- One-click GIF creation right on YouTube
- Custom text overlays
- Multiple quality presets
- Built-in GIF library
- 100% private (local storage only)

It's free and open source!`;
}

// Reddit Template
export function getRedditTemplate(): string {
  return `**YTGify - Create GIFs from YouTube Videos**

I've been using this Chrome extension and it's fantastic for creating GIFs directly from YouTube videos. Here's what I love about it:

- **No downloads needed** - Works right in your browser
- **Text overlays** - Add custom text (top/bottom) with multiple fonts
- **Quality control** - Choose from Fast, Balanced, or High Quality presets
- **GIF library** - All your creations saved locally
- **Privacy-focused** - No data collection, everything stays on your device

It's free, open source, and has no ads or watermarks. If you need to make GIFs from YouTube videos, this is the tool.`;
}

// Generate Twitter share URL
export function generateTwitterShareUrl(text: string): string {
  const baseUrl = 'https://twitter.com/intent/tweet';
  const params = new URLSearchParams({
    text,
    url: 'https://chromewebstore.google.com/detail/ytgify/dnljofakogbecppbkmnoffppkfdmpfje',
    hashtags: 'YTGify,ChromeExtension'
  });
  return `${baseUrl}?${params.toString()}`;
}

// Copy to clipboard with feedback
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}
