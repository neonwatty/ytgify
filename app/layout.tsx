import type { Metadata } from "next";
import "./globals.css";
import GoogleAnalytics from "./components/GoogleAnalytics";
import { SITE_URL, SITE_NAME, SITE_TITLE, SITE_DESCRIPTION } from "@/lib/constants";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  keywords: "youtube to gif, youtube to gif converter, youtube to gif no watermark, youtube to gif chrome extension, gif maker from youtube video, animated gif maker from video, create gif from youtube, convert youtube video to gif, gif meme maker",
  authors: [{ name: "Jeremy Watt" }],
  creator: "Jeremy Watt",
  publisher: SITE_NAME,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: SITE_TITLE,
    description: "Free YouTube to GIF converter. Create animated GIFs from any YouTube video - no watermark, no uploads. Perfect for memes and social sharing.",
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: 'en_US',
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "YTgify - Free YouTube to GIF Converter - No Watermark",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "YTgify - Free YouTube to GIF Converter | No Watermark",
    description: "Free YouTube to GIF converter. Create animated GIFs from any video - no watermark, no uploads. Perfect for memes.",
    images: [`${SITE_URL}/twitter-image.png`],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": SITE_NAME,
    "url": SITE_URL,
    "description": SITE_DESCRIPTION,
    "applicationCategory": "MultimediaApplication",
    "operatingSystem": "Chrome, Firefox",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "featureList": [
      "Convert YouTube videos to GIF",
      "Custom text overlay",
      "FPS control",
      "Multiple resolutions",
      "MP4 to GIF conversion"
    ],
    "screenshot": `${SITE_URL}/og-image.png`,
    "creator": {
      "@type": "Person",
      "name": "Jeremy Watt"
    }
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="antialiased">
        <GoogleAnalytics />
        {children}
      </body>
    </html>
  );
}