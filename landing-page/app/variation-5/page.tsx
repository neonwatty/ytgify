import Logo from '../components/Logo';
import HeroDescription from '../components/HeroDescription';
import FeatureChecklist from '../components/FeatureChecklist';
import DemoVideo from '../components/DemoVideo';
import ChromeStoreBadge from '../components/ChromeStoreBadge';
import GradientButton from '../components/GradientButton';
import { CHROME_EXTENSION_URL } from '@/lib/constants';

export default function Variation5() {
  return (
    <main className="min-h-screen bg-gray-100">
      {/* Sticky Header Bar */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-[700px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10">
              <Logo />
            </div>
            <span className="font-bold text-lg">YTgify</span>
          </div>
          <GradientButton href={CHROME_EXTENSION_URL} size="sm" external>
            Install
          </GradientButton>
        </div>
      </header>

      {/* Narrow Content - 700px */}
      <div className="max-w-[700px] mx-auto px-6 py-16">
        <h1 className="text-5xl font-bold mb-8 text-gray-900">
          Turn your favorite YouTube moments into shareable GIFs.
        </h1>

        <div className="text-lg text-gray-700 mb-12">
          <HeroDescription />
        </div>

        <div className="mb-16">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">Key Features</h2>
          <FeatureChecklist />
        </div>

        {/* Floating Video Overlay */}
        <div className="relative mb-16">
          <div className="sticky top-24 bg-white rounded-2xl shadow-2xl p-4 border-4 border-purple-500">
            <DemoVideo />
          </div>
        </div>

        <div className="prose prose-lg max-w-none mb-16">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">How it works</h2>
          <p className="text-gray-700">
            YTgify integrates directly into your YouTube viewing experience. Simply watch a video,
            click the YTgify button when you find a moment you want to capture, select your time
            range, add optional text overlay, and export your GIF. It&apos;s that simple.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-lg mb-16">
          <h2 className="text-2xl font-bold mb-6 text-gray-900 text-center">
            Ready to get started?
          </h2>
          <div className="flex flex-col items-center gap-6">
            <GradientButton href={CHROME_EXTENSION_URL} size="lg" external>
              Add to Chrome - It&apos;s Free
            </GradientButton>
            <ChromeStoreBadge />
          </div>
        </div>
      </div>
    </main>
  );
}
