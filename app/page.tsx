import Logo from './components/Logo';
import HeroDescription from './components/HeroDescription';
import FeatureChecklist from './components/FeatureChecklist';
import DemoVideo from './components/DemoVideo';
import ExampleGifsGallery from './components/ExampleGifsGallery';
import SiteFooter from './components/SiteFooter';
import DiscontinuationNotice from './components/DiscontinuationNotice';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] grid-pattern">
      <main>
        {/* Ultra Narrow Blog Style - Max 800px */}
        <article className="max-w-[800px] mx-auto px-12 sm:px-6 pt-12 pb-16">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mt-2 mb-8">
            <Logo />
            <h2 className="text-4xl sm:text-5xl font-bold text-white">YTgify</h2>
          </div>

          {/* Discontinuation Notice and Local Install Instructions */}
          <DiscontinuationNotice />

          {/* Large headline */}
          <h1 className="text-3xl sm:text-4xl font-bold mb-8 leading-tight text-white tracking-tight">
            YouTube to GIF Converter - Free, No Watermark
          </h1>

          {/* Description and Example GIFs - Two Column Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 mb-10">
            {/* Left: Description */}
            <div>
              <HeroDescription />
            </div>

            {/* Right: GIF Gallery */}
            <div className="flex items-center">
              <ExampleGifsGallery />
            </div>
          </div>

          {/* Benefit Callout */}
          <div className="text-center mb-16 py-6 px-4 rounded-lg bg-gray-900/50 border border-gray-800">
            <p className="text-lg text-white font-semibold mb-1">Your first GIF in under 30 seconds.</p>
            <p className="text-gray-400">No account needed. No software to download. Works right inside YouTube.</p>
          </div>

          {/* Features and Video - Single Section */}
          <div className="mb-12">
            <h2 className="text-3xl font-bold mb-6 text-white">See it in action</h2>
            {/* Features above video */}
            <div className="mb-6">
              <FeatureChecklist />
            </div>
            {/* Video */}
            <DemoVideo />

            {/* CTA after video */}
            <div className="mt-12 text-center">
              <p className="text-xl text-white mb-6 font-semibold">Ready to create your first GIF?</p>
              <a
                href="/downloads/ytgify-v1.0.19-chrome.zip"
                download
                className="inline-flex items-center gap-3 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download YTgify for Chrome
              </a>
              <p className="text-gray-400 text-sm mt-4">100% free. No watermark. No tracking. Ever.</p>
              <p className="text-gray-500 text-xs mt-2">See installation instructions above</p>
            </div>
          </div>
        </article>

        <SiteFooter />
      </main>
    </div>
  );
}
