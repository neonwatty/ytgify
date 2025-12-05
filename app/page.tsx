import Logo from './components/Logo';
import HeroDescription from './components/HeroDescription';
import FeatureChecklist from './components/FeatureChecklist';
import DemoVideo from './components/DemoVideo';
import ChromeStoreBadge from './components/ChromeStoreBadge';
import FirefoxStoreBadge from './components/FirefoxStoreBadge';
import ExampleGifsGallery from './components/ExampleGifsGallery';
import SiteFooter from './components/SiteFooter';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] grid-pattern">
      <main>
        {/* Ultra Narrow Blog Style - Max 800px */}
        <article className="max-w-[800px] mx-auto px-12 sm:px-6 pt-12 pb-16">
          {/* Logo and Chrome Store Badge - Side by Side */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8 mt-2 mb-8">
            <div className="flex items-center gap-3 flex-shrink-0">
              <Logo />
              <h2 className="text-4xl sm:text-5xl font-bold text-white">YTgify</h2>
            </div>
            <div className="flex-shrink-0">
              <ChromeStoreBadge />
            </div>
          </div>

          {/* Large headline */}
          <h1 className="text-3xl sm:text-4xl font-bold mb-8 leading-tight text-white tracking-tight">
            YouTube to GIF Converter - No Watermark
          </h1>

          {/* Description and Example GIFs - Two Column Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 mb-16">
            {/* Left: Description */}
            <div>
              <HeroDescription />
            </div>

            {/* Right: GIF Gallery */}
            <div className="flex items-center">
              <ExampleGifsGallery />
            </div>
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
              <p className="text-xl text-white mb-6 font-semibold">Ready to create GIFs?</p>
              <div className="flex flex-col sm:flex-row items-start justify-center gap-6">
                <ChromeStoreBadge />
                <FirefoxStoreBadge />
              </div>
            </div>
          </div>
        </article>

        <SiteFooter />
      </main>
    </div>
  );
}
