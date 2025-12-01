import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { SITE_URL, SITE_NAME } from '@/lib/constants';
import SiteFooter from '@/app/components/SiteFooter';

export const metadata: Metadata = {
  title: `Privacy Policy | ${SITE_NAME}`,
  description:
    'YTgify privacy policy. Learn how we protect your data with our zero-collection model.',
  alternates: {
    canonical: `${SITE_URL}/privacy-policy`,
  },
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <article className="max-w-[800px] mx-auto px-6 sm:px-12 pt-12 pb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[#a0a0a0] hover:text-white transition-colors mb-8"
        >
          <ArrowLeft size={16} />
          Back to Home
        </Link>

        <header className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Privacy Policy
          </h1>
          <p className="text-[#606060] text-sm">Last updated: January 2025</p>
        </header>

        <div className="prose prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Overview</h2>
            <p className="text-[#a0a0a0] leading-relaxed">
              YTgify is a browser extension designed to create GIFs from YouTube
              videos while maintaining strict privacy protections. We believe in
              complete transparency about how your data is handled.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              Zero-Collection Model
            </h2>
            <p className="text-[#a0a0a0] leading-relaxed mb-4">
              YTgify does <strong className="text-white">NOT</strong>:
            </p>
            <ul className="list-disc list-inside text-[#a0a0a0] space-y-2">
              <li>Collect personal information</li>
              <li>Track user behavior or analytics</li>
              <li>Send any data to external servers</li>
              <li>Share data with third parties</li>
              <li>Use cookies for tracking purposes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              Local Processing
            </h2>
            <p className="text-[#a0a0a0] leading-relaxed">
              All GIF creation and processing happens entirely on your device.
              The extension stores GIFs and user settings exclusively on your
              device using your browser&apos;s built-in storage systems. No
              information is transmitted to external servers or third parties.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              Data You Control
            </h2>
            <p className="text-[#a0a0a0] leading-relaxed mb-4">
              You maintain complete authority over your data. You can remove all
              stored information at any time by:
            </p>
            <ul className="list-disc list-inside text-[#a0a0a0] space-y-2">
              <li>Uninstalling the extension</li>
              <li>Clearing extension data through browser settings</li>
              <li>Using the built-in deletion features</li>
            </ul>
            <p className="text-[#a0a0a0] leading-relaxed mt-4">
              <strong className="text-white">Your GIFs are yours alone.</strong>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              Required Permissions
            </h2>
            <p className="text-[#a0a0a0] leading-relaxed mb-4">
              The extension requires specific permissions to function:
            </p>
            <ul className="list-disc list-inside text-[#a0a0a0] space-y-2">
              <li>
                <strong className="text-white">Active tab access:</strong> To
                interact with YouTube video pages
              </li>
              <li>
                <strong className="text-white">Download capability:</strong> To
                save GIFs to your device
              </li>
              <li>
                <strong className="text-white">Storage:</strong> To save your
                preferences locally
              </li>
            </ul>
            <p className="text-[#a0a0a0] leading-relaxed mt-4">
              These permissions serve only the core GIF-creation function and
              are never used for data collection.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              YouTube Terms of Service
            </h2>
            <p className="text-[#a0a0a0] leading-relaxed">
              YTgify respects YouTube&apos;s Terms of Service and does not
              circumvent any platform restrictions. The extension only works
              with publicly available video content.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              Open Source Transparency
            </h2>
            <p className="text-[#a0a0a0] leading-relaxed">
              YTgify&apos;s code is publicly available on{' '}
              <a
                href="https://github.com/neonwatty/ytgify"
                target="_blank"
                rel="noopener noreferrer"
                className="text-ytg-pink hover:underline"
              >
                GitHub
              </a>
              , allowing independent verification of our privacy claims. We
              encourage security researchers and users to review our code.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Contact</h2>
            <p className="text-[#a0a0a0] leading-relaxed">
              For privacy-related questions or concerns, you can reach us via:
            </p>
            <ul className="list-disc list-inside text-[#a0a0a0] space-y-2 mt-4">
              <li>
                GitHub Issues:{' '}
                <a
                  href="https://github.com/neonwatty/ytgify/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ytg-pink hover:underline"
                >
                  github.com/neonwatty/ytgify/issues
                </a>
              </li>
              <li>
                Email:{' '}
                <a
                  href="mailto:neonwatty@gmail.com"
                  className="text-ytg-pink hover:underline"
                >
                  neonwatty@gmail.com
                </a>
              </li>
            </ul>
          </section>
        </div>
      </article>
      <SiteFooter />
    </main>
  );
}
