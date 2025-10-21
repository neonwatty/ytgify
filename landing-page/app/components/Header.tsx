import Link from 'next/link';

export default function Header() {
  return (
    <header
      className="sticky top-0 z-40 backdrop-blur-md transition-all duration-300"
      style={{
        background: 'var(--gradient-elevated)',
        borderBottom: '1px solid var(--color-border-primary)',
        boxShadow: 'var(--shadow-subtle)'
      }}
    >
      <nav className="max-w-[800px] mx-auto px-6 py-6" aria-label="Top">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="font-bold text-lg transition-all duration-300"
            style={{
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.02em',
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
            }}
          >
            YTgify
          </Link>

          <div className="flex items-center space-x-8">
            <a
              href="https://github.com/neonwatty/ytgify/blob/main/docs/privacy-policy.md"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium transition-all duration-300 relative group"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <span className="group-hover:text-opacity-100 transition-all duration-300">
                Privacy
              </span>
              <span
                className="absolute bottom-0 left-0 w-0 h-px transition-all duration-300 group-hover:w-full"
                style={{ background: 'var(--color-border-primary)' }}
              ></span>
            </a>
          </div>
        </div>
      </nav>
    </header>
  );
}
