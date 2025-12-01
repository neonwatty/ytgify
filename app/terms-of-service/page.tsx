import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { SITE_URL, SITE_NAME } from '@/lib/constants';
import SiteFooter from '@/app/components/SiteFooter';

export const metadata: Metadata = {
  title: `Terms of Service | ${SITE_NAME}`,
  description:
    'YTgify terms of service. Review the terms and conditions for using the YTgify browser extension.',
  alternates: {
    canonical: `${SITE_URL}/terms-of-service`,
  },
};

export default function TermsOfServicePage() {
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
            Terms of Service
          </h1>
          <p className="text-[#606060] text-sm">Last updated: January 2025</p>
        </header>

        <div className="prose prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              Acceptance of Terms
            </h2>
            <p className="text-[#a0a0a0] leading-relaxed">
              By installing or using YTgify, you agree to these Terms of
              Service. If you do not agree to these terms, do not use the
              extension.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              Description of Service
            </h2>
            <p className="text-[#a0a0a0] leading-relaxed">
              YTgify is a browser extension that allows users to create animated
              GIF files from YouTube videos. The extension processes video
              frames locally on your device and saves the resulting GIF to your
              Downloads folder.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              User Responsibilities
            </h2>
            <p className="text-[#a0a0a0] leading-relaxed mb-4">
              You agree to use YTgify responsibly and in compliance with
              applicable laws. You are solely responsible for:
            </p>
            <ul className="list-disc list-inside text-[#a0a0a0] space-y-2">
              <li>
                Ensuring your use of created GIFs complies with copyright laws
              </li>
              <li>
                Respecting YouTube&apos;s Terms of Service when using the
                extension
              </li>
              <li>Not using the extension for any illegal or harmful purpose</li>
              <li>
                Obtaining necessary permissions before sharing GIFs created from
                copyrighted content
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              Intellectual Property
            </h2>
            <p className="text-[#a0a0a0] leading-relaxed">
              YTgify is open source software licensed under the MIT License. The
              extension code is available on GitHub. GIFs you create using
              YTgify may contain content subject to third-party copyrights. You
              are responsible for ensuring your use of such content is lawful.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              Disclaimer of Warranties
            </h2>
            <p className="text-[#a0a0a0] leading-relaxed">
              YTgify is provided &quot;as is&quot; without warranties of any
              kind, either express or implied. We do not guarantee that the
              extension will be error-free, uninterrupted, or compatible with
              all systems or YouTube updates.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              Limitation of Liability
            </h2>
            <p className="text-[#a0a0a0] leading-relaxed">
              To the maximum extent permitted by law, the developers of YTgify
              shall not be liable for any indirect, incidental, special,
              consequential, or punitive damages arising from your use of the
              extension.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              Changes to Terms
            </h2>
            <p className="text-[#a0a0a0] leading-relaxed">
              We may update these Terms of Service from time to time. Continued
              use of YTgify after changes constitutes acceptance of the updated
              terms. We encourage you to review this page periodically.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">Contact</h2>
            <p className="text-[#a0a0a0] leading-relaxed">
              For questions about these Terms of Service, contact us via:
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
