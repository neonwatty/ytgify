import Logo from '../components/Logo';
import HeroDescription from '../components/HeroDescription';
import FeatureChecklist from '../components/FeatureChecklist';
import DemoVideo from '../components/DemoVideo';
import ChromeStoreBadge from '../components/ChromeStoreBadge';
import GradientButton from '../components/GradientButton';
import { CHROME_EXTENSION_URL } from '@/lib/constants';

export default function Variation8() {
  return (
    <main className="min-h-screen bg-gray-950 p-4 sm:p-8">
      {/* Dashboard/Control Panel Style */}
      <div className="max-w-[1400px] mx-auto">
        {/* Top Bar */}
        <div className="bg-gray-900 rounded-2xl p-6 mb-4 flex items-center justify-between border border-gray-800">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12">
              <Logo />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">YTgify Dashboard</h1>
              <p className="text-sm text-gray-400">GIF Creation Control Panel</p>
            </div>
          </div>
          <GradientButton href={CHROME_EXTENSION_URL} size="md" external>
            Install Extension
          </GradientButton>
        </div>

        {/* Widget Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Large Widget - Spans 2 columns on large screens */}
          <div className="lg:col-span-2 bg-gray-900 rounded-2xl p-8 border border-gray-800">
            <h2 className="text-xl font-bold text-white mb-2">Live Preview</h2>
            <p className="text-sm text-gray-400 mb-6">See how it works</p>
            <DemoVideo />
          </div>

          {/* Stats Widget */}
          <div className="bg-gradient-to-br from-purple-900 to-pink-900 rounded-2xl p-8 border border-purple-700">
            <div className="text-sm text-purple-200 mb-2">DESCRIPTION</div>
            <div className="text-white">
              <HeroDescription />
            </div>
          </div>

          {/* Features Widget - Spans 2 columns */}
          <div className="md:col-span-2 bg-gray-900 rounded-2xl p-8 border border-gray-800">
            <h2 className="text-xl font-bold text-white mb-2">Features Overview</h2>
            <p className="text-sm text-gray-400 mb-6">What you get with YTgify</p>
            <FeatureChecklist />
          </div>

          {/* Quick Action Widget */}
          <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800 flex flex-col justify-center">
            <div className="text-sm text-gray-400 mb-4">QUICK ACTION</div>
            <h3 className="text-2xl font-bold text-white mb-6">Get Started Now</h3>
            <GradientButton href={CHROME_EXTENSION_URL} size="lg" external>
              Install
            </GradientButton>
          </div>

          {/* Status Widget */}
          <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800">
            <div className="text-sm text-gray-400 mb-4">STATUS</div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-white font-semibold">Extension Available</span>
            </div>
            <div className="text-sm text-gray-400">
              Ready to install on Chrome Web Store
            </div>
          </div>

          {/* Download Widget */}
          <div className="md:col-span-2 bg-gray-900 rounded-2xl p-8 border border-gray-800 flex items-center justify-center">
            <ChromeStoreBadge />
          </div>
        </div>
      </div>
    </main>
  );
}
