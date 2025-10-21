import Image from 'next/image';

export default function GitHubStyleFooter() {
  return (
    <footer className="relative border-t border-[#30363d]/60">
      <div className="relative max-w-[1280px] mx-auto px-6 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Logo and copyright */}
          <div className="flex items-center gap-2.5">
            <Image
              alt="YTgify"
              loading="lazy"
              width={20}
              height={20}
              className="w-5 h-5 opacity-70"
              src="/ytgify-logo.svg"
            />
            <span className="text-xs text-[#7d8590]">
              © {new Date().getFullYear()} YTgify
            </span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-5 text-xs">
            <a
              href="https://chromewebstore.google.com/detail/ytgify/dnljofakogbecppbkmnoffppkfdmpfje"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#7d8590] hover:text-[#58a6ff] transition-colors"
            >
              Chrome Store
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
