import Logo from '../components/Logo';
import ChromeStoreBadge from '../components/ChromeStoreBadge';
import GradientButton from '../components/GradientButton';
import { CHROME_EXTENSION_URL } from '@/lib/constants';

export default function Variation10() {
  return (
    <main className="min-h-screen bg-white flex items-center justify-center p-6">
      {/* Extreme Minimalist - Ultra Sparse, Max 400px */}
      <div className="max-w-[400px] w-full text-center space-y-24">
        {/* Tiny logo */}
        <div className="flex justify-center">
          <div className="w-10 h-10">
            <Logo />
          </div>
        </div>

        {/* Headline */}
        <h1 className="text-4xl font-bold text-gray-900 leading-tight">
          YouTube to GIF
        </h1>

        {/* Single line description */}
        <p className="text-lg text-gray-600">
          One click. No sign-up. Free forever.
        </p>

        {/* Minimal CTA */}
        <div>
          <GradientButton href={CHROME_EXTENSION_URL} size="md" external>
            Install
          </GradientButton>
        </div>

        {/* Tiny badge */}
        <div className="opacity-40 hover:opacity-100 transition-opacity">
          <div className="scale-75">
            <ChromeStoreBadge />
          </div>
        </div>
      </div>
    </main>
  );
}
