'use client';

import Logo from '../components/Logo';
import HeroDescription from '../components/HeroDescription';
import FeatureChecklist from '../components/FeatureChecklist';
import DemoVideo from '../components/DemoVideo';
import ChromeStoreBadge from '../components/ChromeStoreBadge';
import GradientButton from '../components/GradientButton';
import { CHROME_EXTENSION_URL } from '@/lib/constants';
import { useEffect, useState } from 'react';

export default function Variation9() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const totalSlides = 5;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && currentSlide < totalSlides - 1) {
        setCurrentSlide(currentSlide + 1);
      } else if (e.key === 'ArrowLeft' && currentSlide > 0) {
        setCurrentSlide(currentSlide - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide]);

  return (
    <main className="h-screen overflow-hidden bg-black">
      {/* Presentation Slides - Full Screen Sections */}
      <div
        className="flex h-full transition-transform duration-500 ease-in-out"
        style={{ transform: `translateX(-${currentSlide * 100}vw)` }}
      >
        {/* Slide 1: Title */}
        <section className="w-screen h-full flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-purple-900 to-pink-900">
          <div className="text-center text-white px-8">
            <div className="mb-12 flex justify-center">
              <div className="w-24 h-24 bg-white/20 rounded-3xl p-5">
                <Logo />
              </div>
            </div>
            <h1 className="text-8xl font-black mb-8">YTgify</h1>
            <p className="text-4xl text-white/90">Turn YouTube moments into GIFs</p>
          </div>
        </section>

        {/* Slide 2: Problem/Solution */}
        <section className="w-screen h-full flex-shrink-0 flex items-center justify-center bg-gray-900">
          <div className="max-w-4xl px-8 text-white">
            <h2 className="text-6xl font-bold mb-12 text-center">The Solution</h2>
            <div className="text-3xl text-gray-300 leading-relaxed text-center">
              <HeroDescription />
            </div>
          </div>
        </section>

        {/* Slide 3: Demo */}
        <section className="w-screen h-full flex-shrink-0 flex items-center justify-center bg-black">
          <div className="max-w-5xl w-full px-8">
            <h2 className="text-6xl font-bold mb-12 text-center text-white">See It Work</h2>
            <DemoVideo />
          </div>
        </section>

        {/* Slide 4: Features */}
        <section className="w-screen h-full flex-shrink-0 flex items-center justify-center bg-gray-900">
          <div className="max-w-3xl px-8 text-white">
            <h2 className="text-6xl font-bold mb-16 text-center">Features</h2>
            <div className="scale-125">
              <FeatureChecklist />
            </div>
          </div>
        </section>

        {/* Slide 5: CTA */}
        <section className="w-screen h-full flex-shrink-0 flex items-center justify-center bg-gradient-to-br from-pink-900 to-purple-900">
          <div className="text-center text-white px-8">
            <h2 className="text-7xl font-black mb-12">Get Started</h2>
            <p className="text-3xl mb-16 text-white/90">Available now on Chrome Web Store</p>
            <div className="flex flex-col items-center gap-8">
              <GradientButton href={CHROME_EXTENSION_URL} size="lg" external>
                Add to Chrome - It&apos;s Free
              </GradientButton>
              <ChromeStoreBadge />
            </div>
          </div>
        </section>
      </div>

      {/* Navigation Dots */}
      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 flex gap-3 z-50">
        {Array.from({ length: totalSlides }).map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentSlide(idx)}
            className={`w-3 h-3 rounded-full transition-all ${
              idx === currentSlide ? 'bg-white w-8' : 'bg-white/40'
            }`}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>

      {/* Navigation Instructions */}
      <div className="fixed bottom-8 right-8 text-white/60 text-sm z-50">
        Use ← → keys or dots to navigate
      </div>
    </main>
  );
}
