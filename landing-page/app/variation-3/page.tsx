import Logo from '../components/Logo';
import HeroDescription from '../components/HeroDescription';
import FeatureChecklist from '../components/FeatureChecklist';
import DemoVideo from '../components/DemoVideo';
import ChromeStoreBadge from '../components/ChromeStoreBadge';
import GradientButton from '../components/GradientButton';
import { CHROME_EXTENSION_URL } from '@/lib/constants';

export default function Variation3() {
  return (
    <main className="min-h-screen bg-white">
      {/* Magazine Multi-column Layout */}
      <div className="max-w-7xl mx-auto px-8 py-16">
        {/* Header */}
        <header className="mb-16 pb-8 border-b-4 border-black">
          <div className="flex items-center justify-between">
            <div className="w-16 h-16">
              <Logo />
            </div>
            <div className="text-sm font-mono">YTGIFY MAGAZINE</div>
          </div>
        </header>

        {/* Main Article in Columns */}
        <article className="columns-1 md:columns-2 lg:columns-3 gap-8 mb-16">
          <div className="break-inside-avoid mb-8">
            <h1 className="text-5xl font-black mb-6 leading-tight">
              Turn YouTube moments into shareable GIFs
            </h1>
          </div>

          <div className="break-inside-avoid mb-8 text-lg text-gray-700 leading-relaxed">
            <HeroDescription />
          </div>

          <div className="break-inside-avoid mb-8">
            <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-6 text-white">
              <h3 className="font-bold mb-4 text-xl">Get Started</h3>
              <GradientButton href={CHROME_EXTENSION_URL} size="md" external>
                Add to Chrome
              </GradientButton>
            </div>
          </div>

          <div className="break-inside-avoid mb-8">
            <h2 className="text-2xl font-bold mb-4">Key Features</h2>
            <FeatureChecklist />
          </div>

          <div className="break-inside-avoid mb-8">
            <div className="bg-gray-100 p-6">
              <h3 className="font-bold mb-4 text-xl">Why YTgify?</h3>
              <p className="text-gray-700">
                A powerful Chrome extension designed for creating GIFs directly from YouTube
                videos. No external tools, no complicated software. Just click and create.
              </p>
            </div>
          </div>
        </article>

        {/* Full-width Demo */}
        <section className="mb-16">
          <h2 className="text-4xl font-black mb-8">See it in Action</h2>
          <DemoVideo />
        </section>

        {/* Footer */}
        <footer className="pt-8 border-t-4 border-black">
          <ChromeStoreBadge />
        </footer>
      </div>
    </main>
  );
}
