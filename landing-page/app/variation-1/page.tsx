import Logo from '../components/Logo';
import HeroDescription from '../components/HeroDescription';
import FeatureChecklist from '../components/FeatureChecklist';
import DemoVideo from '../components/DemoVideo';
import ChromeStoreBadge from '../components/ChromeStoreBadge';
import GradientButton from '../components/GradientButton';
import { CHROME_EXTENSION_URL } from '@/lib/constants';

export default function Variation1() {
  return (
    <main className="min-h-screen bg-gray-50">
      {/* Ultra Narrow Blog Style - Max 700px */}
      <article className="max-w-[700px] mx-auto px-6 py-24">
        {/* Tiny logo */}
        <div className="mb-16">
          <div className="w-12 h-12">
            <Logo />
          </div>
        </div>

        {/* Large headline with lots of space */}
        <h1 className="text-5xl font-bold mb-12 leading-tight text-gray-900">
          Turn your favorite YouTube moments into shareable GIFs.
        </h1>

        {/* Spacious description */}
        <div className="text-xl text-gray-700 mb-16 leading-relaxed">
          <HeroDescription />
        </div>

        {/* Features with Chrome Store Badge */}
        <div className="mb-24">
          <h2 className="text-3xl font-bold mb-6 text-gray-900">Features</h2>
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
        <div className="mb-24">
          <h2 className="text-3xl font-bold mb-8 text-gray-900">See it in action</h2>
          <DemoVideo />
        </div>
      </article>

      {/* Footer */}
      <footer className="max-w-[700px] mx-auto px-6 py-12 border-t border-gray-200">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
          <p className="text-sm text-gray-600">
            © {new Date().getFullYear()} YTgify. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm">
            <a href="https://github.com/neonwatty/ytgify/blob/main/docs/privacy-policy.md" target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-gray-900 transition-colors">
              Privacy Policy
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
