import Logo from '../components/Logo';
import HeroDescription from '../components/HeroDescription';
import FeatureChecklist from '../components/FeatureChecklist';
import DemoVideo from '../components/DemoVideo';
import ChromeStoreBadge from '../components/ChromeStoreBadge';

export default function Variation11() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] grid-pattern">
      <main>
        {/* Ultra Narrow Blog Style - Max 800px */}
        <article className="max-w-[800px] mx-auto px-12 sm:px-6 pt-24 pb-32">
          {/* Tiny logo */}
          <div className="mt-16 mb-20">
            <div className="w-14 h-14">
              <Logo />
            </div>
          </div>

          {/* Large headline with lots of space */}
          <h1 className="text-7xl sm:text-8xl font-bold mb-16 leading-tight text-white tracking-tight">
            Turn your favorite YouTube moments into GIFs
          </h1>

          {/* Spacious description */}
          <div className="mb-20">
            <HeroDescription />
          </div>

          {/* Features with Chrome Store Badge */}
          <div className="mb-32">
            <h2 className="text-5xl font-bold mb-8 text-white">Features</h2>
            <div className="flex gap-8 items-center">
              <div className="flex-1 [&>div]:grid-cols-2">
                <FeatureChecklist />
              </div>
              <div className="flex-shrink-0">
                <ChromeStoreBadge />
              </div>
            </div>
          </div>

          {/* Video with generous spacing */}
          <div className="mb-32">
            <h2 className="text-5xl font-bold mb-12 text-white">See it in action</h2>
            <DemoVideo />
          </div>
        </article>

        {/* Footer */}
        <footer className="max-w-[800px] mx-auto px-12 sm:px-6 py-16 border-t border-[#2a2a2a]">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
            <p className="text-sm text-[#a0a0a0]">
              © {new Date().getFullYear()} YTgify. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm">
              <a href="https://github.com/neonwatty/ytgify/blob/main/docs/privacy-policy.md" target="_blank" rel="noopener noreferrer" className="text-[#a0a0a0] hover:text-white transition-colors">
                Privacy Policy
              </a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
