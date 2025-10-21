import Logo from './Logo';
import HeroHeadline from './HeroHeadline';
import HeroDescription from './HeroDescription';
import FeatureChecklist from './FeatureChecklist';
import DemoVideo from './DemoVideo';

export default function GitHubStyleHero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-900 to-gray-950">
      <div className="relative max-w-[1280px] mx-auto px-6 py-16 sm:py-24 lg:py-32">
        <Logo />
        <HeroHeadline />

        {/* Two-column layout: Left text, Right video */}
        <div className="max-w-6xl mx-auto">
          <div className="hero-two-col-grid gap-12 lg:gap-16 items-center">
            {/* Left Column - Text Content */}
            <div className="space-y-8">
              <HeroDescription />
              <FeatureChecklist />
            </div>

            {/* Right Column - Demo Video */}
            <DemoVideo />
          </div>
        </div>
      </div>
    </section>
  );
}
