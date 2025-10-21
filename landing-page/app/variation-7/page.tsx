'use client';

import Logo from '../components/Logo';
import HeroDescription from '../components/HeroDescription';
import DemoVideo from '../components/DemoVideo';
import ChromeStoreBadge from '../components/ChromeStoreBadge';
import GradientButton from '../components/GradientButton';
import { CHROME_EXTENSION_URL } from '@/lib/constants';

export default function Variation7() {
  const features = [
    { title: '100% Free', desc: 'No hidden costs or subscriptions' },
    { title: 'One-Click', desc: 'Create GIFs with a single click' },
    { title: 'No Sign-up', desc: 'Start using immediately' },
    { title: 'Custom Text', desc: 'Add text overlays to your GIFs' },
    { title: 'Open Source', desc: 'Fully transparent codebase' },
    { title: 'Multiple Formats', desc: 'Export in various sizes' },
  ];

  return (
    <main className="min-h-screen bg-gray-900">
      {/* Card Carousel - Horizontal Scroll */}
      <div className="max-w-[800px] mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16">
              <Logo />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            YTgify
          </h1>
          <p className="text-gray-400">
            Swipe through to learn more
          </p>
        </div>

        {/* Horizontal Scrolling Cards */}
        <div className="overflow-x-auto pb-8 mb-12">
          <div className="flex gap-6" style={{ width: 'max-content' }}>
            {/* Card 1: Hero */}
            <div className="w-[700px] bg-gradient-to-br from-purple-600 to-pink-600 rounded-3xl p-12 flex-shrink-0">
              <h2 className="text-5xl font-black text-white mb-6 leading-tight">
                Turn YouTube moments into shareable GIFs
              </h2>
              <div className="text-white/90 text-lg mb-8">
                <HeroDescription />
              </div>
              <GradientButton href={CHROME_EXTENSION_URL} size="lg" external>
                Get Started
              </GradientButton>
            </div>

            {/* Card 2: Demo */}
            <div className="w-[700px] bg-gray-800 rounded-3xl p-8 flex-shrink-0">
              <h2 className="text-3xl font-bold text-white mb-6">See it in action</h2>
              <DemoVideo />
            </div>

            {/* Feature Cards */}
            {features.map((feature, idx) => (
              <div key={idx} className="w-[350px] bg-gray-800 rounded-3xl p-8 flex-shrink-0 flex flex-col justify-center">
                <h3 className="text-3xl font-bold text-white mb-4">{feature.title}</h3>
                <p className="text-gray-300 text-lg">{feature.desc}</p>
              </div>
            ))}

            {/* Final CTA Card */}
            <div className="w-[700px] bg-white rounded-3xl p-12 flex-shrink-0 flex flex-col items-center justify-center">
              <h2 className="text-4xl font-bold text-gray-900 mb-8 text-center">
                Ready to start creating?
              </h2>
              <div className="flex flex-col items-center gap-6">
                <GradientButton href={CHROME_EXTENSION_URL} size="lg" external>
                  Add to Chrome
                </GradientButton>
                <ChromeStoreBadge />
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="text-center text-gray-500 text-sm">
          ← Scroll horizontally to explore →
        </div>
      </div>
    </main>
  );
}
