import type { Metadata } from "next";
import "./globals.css";
import GoogleAnalytics from "./components/GoogleAnalytics";

export const metadata: Metadata = {
  title: "YTgify - Free Animated GIF Maker | Convert YouTube Videos to GIF",
  description: "Free animated GIF maker for YouTube. Create and make animated GIFs from any video in seconds. Convert YouTube videos, MP4s into GIFs with custom text, FPS control, and multiple resolutions. Perfect for memes and social sharing.",
  keywords: "animated gif maker, video to gif, make animated gif, gif create, youtube to gif, video into gif, mp4 to gif, gif maker, create animated gifs, youtube gif maker, gif creator, gif meme maker, chrome extension",
  authors: [{ name: "Jeremy Watt" }],
  openGraph: {
    title: "YTgify - Free Animated GIF Maker | Convert YouTube Videos to GIF",
    description: "Free animated GIF maker for YouTube. Create and make animated GIFs from any video in seconds. Perfect for memes and social sharing.",
    type: "website",
    url: "https://ytgify.com",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "YTgify - Animated GIF Maker for YouTube Videos",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "YTgify - Free Animated GIF Maker for YouTube",
    description: "Create animated GIFs from any YouTube video in seconds. Perfect for memes and social sharing.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <GoogleAnalytics />
        {children}
      </body>
    </html>
  );
}