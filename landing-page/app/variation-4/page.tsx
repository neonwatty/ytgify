import Logo from '../components/Logo';
import HeroDescription from '../components/HeroDescription';
import FeatureChecklist from '../components/FeatureChecklist';
import DemoVideo from '../components/DemoVideo';
import ChromeStoreBadge from '../components/ChromeStoreBadge';
import GradientButton from '../components/GradientButton';
import { CHROME_EXTENSION_URL } from '@/lib/constants';

export default function Variation4() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
      {/* Asymmetric 40/60 Grid with Zigzag Flow */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        {/* Row 1: 40% Left, 60% Right */}
        <div className="grid grid-cols-5 gap-8 mb-16">
          <div className="col-span-2 flex items-center">
            <div>
              <div className="w-16 h-16 mb-8">
                <Logo />
              </div>
              <h1 className="text-4xl font-bold">YTgify</h1>
            </div>
          </div>
          <div className="col-span-3 flex items-center">
            <div>
              <p className="text-6xl font-black leading-tight mb-6">
                Turn YouTube moments into GIFs
              </p>
              <GradientButton href={CHROME_EXTENSION_URL} size="lg" external>
                Get Started
              </GradientButton>
            </div>
          </div>
        </div>

        {/* Row 2: 60% Left, 40% Right (Zigzag) */}
        <div className="grid grid-cols-5 gap-8 mb-16">
          <div className="col-span-3">
            <DemoVideo />
          </div>
          <div className="col-span-2 flex items-center">
            <div className="text-lg text-gray-300">
              <HeroDescription />
            </div>
          </div>
        </div>

        {/* Row 3: 40% Left, 60% Right */}
        <div className="grid grid-cols-5 gap-8 mb-16">
          <div className="col-span-2 flex items-center">
            <div>
              <h2 className="text-3xl font-bold">Why choose YTgify?</h2>
            </div>
          </div>
          <div className="col-span-3">
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8">
              <FeatureChecklist />
            </div>
          </div>
        </div>

        {/* Row 4: Centered */}
        <div className="flex justify-center py-12">
          <ChromeStoreBadge />
        </div>
      </div>
    </main>
  );
}
