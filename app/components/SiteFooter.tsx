'use client';

import { useState, useEffect } from 'react';

export default function SiteFooter() {
  const [currentYear, setCurrentYear] = useState(2025);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  return (
    <footer className="max-w-[800px] mx-auto px-12 sm:px-6 py-16 border-t border-[#2a2a2a]">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
        <p className="text-sm text-[#a0a0a0]">
          © {currentYear} YTgify. All rights reserved.
        </p>
        <div className="flex gap-6 text-sm">
          <a
            href="https://chromewebstore.google.com/detail/ytgify/jhjdimdoghooebpklbfhpggnaakiollk"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#a0a0a0] hover:text-white transition-colors"
          >
            Install Chrome Extension
          </a>
          <a
            href="https://github.com/neonwatty/ytgify/blob/main/docs/privacy-policy.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#a0a0a0] hover:text-white transition-colors"
          >
            Privacy Policy
          </a>
        </div>
      </div>
    </footer>
  );
}
