import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YTgify - Turn YouTube Videos into GIFs",
  description: "Create perfect GIFs from any YouTube video with just one click. Add text, customize quality, and share instantly. Free Chrome extension.",
  keywords: "YouTube GIF, GIF maker, YouTube to GIF, Chrome extension, video to GIF, GIF creator",
  authors: [{ name: "Jeremy Watt" }],
  openGraph: {
    title: "YTgify - Turn YouTube Videos into GIFs",
    description: "Create perfect GIFs from any YouTube video with just one click.",
    type: "website",
    url: "https://neonwatty.github.io/ytgify",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "YTgify - YouTube to GIF Converter",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "YTgify - Turn YouTube Videos into GIFs",
    description: "Create perfect GIFs from any YouTube video with just one click.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}