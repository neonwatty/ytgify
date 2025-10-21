import Logo from '../components/Logo';
import HeroDescription from '../components/HeroDescription';
import FeatureChecklist from '../components/FeatureChecklist';
import DemoVideo from '../components/DemoVideo';
import ChromeStoreBadge from '../components/ChromeStoreBadge';
import GradientButton from '../components/GradientButton';
import { CHROME_EXTENSION_URL } from '@/lib/constants';

export default function Variation6() {
  return (
    <main className="min-h-screen bg-white">
      {/* Full Bleed Images with Narrow Text */}

      {/* Section 1: Hero with narrow text */}
      <section className="relative h-screen bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
        <div className="max-w-[650px] mx-auto px-6 text-center text-white">
          <div className="mb-12 flex justify-center">
            <div className="w-20 h-20 bg-white/20 rounded-full p-4">
              <Logo />
            </div>
          </div>
          <h1 className="text-6xl font-black mb-8 leading-tight">
            Turn YouTube moments into GIFs
          </h1>
          <div className="text-xl mb-12 text-white/90">
            <HeroDescription />
          </div>
          <GradientButton href={CHROME_EXTENSION_URL} size="lg" external>
            Get Started
          </GradientButton>
        </div>
      </section>

      {/* Section 2: Narrow text on white */}
      <section className="py-24">
        <div className="max-w-[650px] mx-auto px-6">
          <h2 className="text-4xl font-bold mb-8 text-gray-900">What you get</h2>
          <FeatureChecklist />
        </div>
      </section>

      {/* Section 3: Full-width video */}
      <section className="bg-gray-900 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-4xl font-bold mb-12 text-white text-center">Watch it in action</h2>
          <DemoVideo />
        </div>
      </section>

      {/* Section 4: Narrow CTA */}
      <section className="py-24 bg-gradient-to-br from-pink-50 to-purple-50">
        <div className="max-w-[650px] mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold mb-8 text-gray-900">
            Ready to create amazing GIFs?
          </h2>
          <p className="text-xl text-gray-700 mb-12">
            Join thousands of users who are already creating and sharing GIFs from their favorite YouTube moments.
          </p>
          <div className="flex flex-col items-center gap-8">
            <GradientButton href={CHROME_EXTENSION_URL} size="lg" external>
              Add to Chrome - It&apos;s Free
            </GradientButton>
            <ChromeStoreBadge />
          </div>
        </div>
      </section>
    </main>
  );
}
