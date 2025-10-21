import Logo from '../components/Logo';
import HeroDescription from '../components/HeroDescription';
import FeatureChecklist from '../components/FeatureChecklist';
import DemoVideo from '../components/DemoVideo';
import ChromeStoreBadge from '../components/ChromeStoreBadge';
import GradientButton from '../components/GradientButton';
import { CHROME_EXTENSION_URL } from '@/lib/constants';

export default function Variation2() {
  return (
    <main className="min-h-screen bg-white flex">
      {/* Fixed Left Sidebar - 250px */}
      <aside className="fixed left-0 top-0 h-screen w-[250px] bg-gradient-to-b from-purple-600 to-pink-600 p-8 flex flex-col">
        <div className="mb-12">
          <div className="w-16 h-16 bg-white/20 rounded-lg p-2">
            <Logo />
          </div>
        </div>

        <div className="flex-1">
          <h2 className="text-white text-2xl font-bold mb-6">YTgify</h2>
          <p className="text-white/90 text-sm mb-8">
            Create GIFs from YouTube videos instantly
          </p>

          <div className="space-y-4">
            <div className="text-white/80 text-sm">
              ✓ 100% Free
            </div>
            <div className="text-white/80 text-sm">
              ✓ One-Click
            </div>
            <div className="text-white/80 text-sm">
              ✓ No Sign-up
            </div>
            <div className="text-white/80 text-sm">
              ✓ Open Source
            </div>
          </div>
        </div>

        <div className="mt-auto">
          <GradientButton href={CHROME_EXTENSION_URL} size="sm" external>
            Install
          </GradientButton>
        </div>
      </aside>

      {/* Scrolling Right Content */}
      <div className="ml-[250px] flex-1">
        <div className="max-w-4xl mx-auto px-12 py-24">
          <h1 className="text-6xl font-black mb-8 text-gray-900">
            Turn YouTube moments into GIFs
          </h1>

          <div className="text-xl text-gray-600 mb-16">
            <HeroDescription />
          </div>

          <div className="mb-16">
            <h2 className="text-3xl font-bold mb-6 text-gray-900">Demo</h2>
            <DemoVideo />
          </div>

          <div className="mb-16">
            <h2 className="text-3xl font-bold mb-6 text-gray-900">All Features</h2>
            <FeatureChecklist />
          </div>

          <div className="pt-12 border-t border-gray-200">
            <ChromeStoreBadge />
          </div>
        </div>
      </div>
    </main>
  );
}
