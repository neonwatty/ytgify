'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Github, BookOpen } from 'lucide-react';
import { FIREFOX_ADDON_URL } from '@/lib/constants';

export default function SiteFooter() {
  const [currentYear, setCurrentYear] = useState(2025);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  return (
    <footer className="max-w-[800px] mx-auto px-12 sm:px-6 py-16 border-t border-[#2a2a2a]">
      <div className="flex flex-col items-center gap-6">
        <p className="text-sm text-[#a0a0a0]">
          © {currentYear} YTgify. All rights reserved.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
          <div className="flex gap-4">
            <a
              href="https://github.com/neonwatty"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#a0a0a0] hover:text-white transition-colors"
              aria-label="GitHub"
            >
              <Github size={20} />
            </a>
            <a
              href="https://x.com/neonwatty"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#a0a0a0] hover:text-white transition-colors"
              aria-label="X (Twitter)"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4l16 16m0-16L4 20" />
              </svg>
            </a>
            <a
              href="https://neonwatty.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#a0a0a0] hover:text-white transition-colors"
              aria-label="Blog"
            >
              <BookOpen size={20} />
            </a>
          </div>
          <Link
            href="/blog"
            className="text-[#a0a0a0] hover:text-white transition-colors"
          >
            Blog
          </Link>
          <a
            href="https://chromewebstore.google.com/detail/ytgify/jhjdimdoghooebpklbfhpggnaakiollk"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#a0a0a0] hover:text-white transition-colors"
          >
            Install Chrome Extension
          </a>
          <a
            href={FIREFOX_ADDON_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#a0a0a0] hover:text-white transition-colors"
          >
            Install Firefox Add-on
          </a>
          <Link
            href="/privacy-policy"
            className="text-[#a0a0a0] hover:text-white transition-colors"
          >
            Privacy Policy
          </Link>
          <Link
            href="/terms-of-service"
            className="text-[#a0a0a0] hover:text-white transition-colors"
          >
            Terms of Service
          </Link>
        </div>
      </div>
    </footer>
  );
}
