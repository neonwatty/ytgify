'use client';

import { useState, useEffect } from 'react';

const EXAMPLE_GIFS = [
  'https://raw.githubusercontent.com/neonwatty/readme_gifs/main/free-gratis.gif',
  'https://raw.githubusercontent.com/neonwatty/readme_gifs/main/boom-baby.gif',
  'https://raw.githubusercontent.com/neonwatty/readme_gifs/main/witness-me.gif',
];

export default function ExampleGifsGallery() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMounted, setIsMounted] = useState(false);

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === EXAMPLE_GIFS.length - 1 ? 0 : prev + 1));
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;

    const interval = setInterval(() => {
      goToNext();
    }, 3000);

    return () => clearInterval(interval);
  }, [currentIndex, isMounted]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  return (
    <div className="relative flex flex-col items-center">
      {/* Carousel Container */}
      <div className="relative w-full max-w-[500px] mx-auto">
        {/* GIF Display with Sliding Animation */}
        <div className="relative rounded-3xl overflow-hidden bg-gray-800 border-2 border-gray-700 shadow-2xl p-2">
          {/* Viewport with overflow hidden */}
          <div className="relative w-full rounded-2xl overflow-hidden">
            {/* Sliding track */}
            <div
              className="flex transition-transform duration-700 ease-in-out"
              style={{ transform: `translateX(-${currentIndex * 100}%)` }}
            >
              {EXAMPLE_GIFS.map((gifUrl, index) => (
                <div key={index} className="w-full flex-shrink-0">
                  <img
                    src={gifUrl}
                    alt={`Example GIF ${index + 1}`}
                    className="w-full h-auto"
                    loading={index === 0 ? 'eager' : 'lazy'}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Dot Indicators */}
      <div className="flex gap-2 mt-6">
        {EXAMPLE_GIFS.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`w-2 h-2 rounded-full transition-colors ${
              index === currentIndex ? 'bg-white' : 'bg-gray-600 hover:bg-gray-400'
            }`}
            aria-label={`Go to GIF ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
