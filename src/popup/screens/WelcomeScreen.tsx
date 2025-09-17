import React from 'react';
import { Button } from '@/components/ui/button';

interface WelcomeScreenProps {
  isYouTubePage: boolean;
  videoTitle?: string;
  isLoading: boolean;
  onContinue: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  isYouTubePage,
  videoTitle,
  isLoading,
  onContinue,
}) => {
  return (
    <div className="h-full flex flex-col items-center justify-center p-6 text-center">
      {/* Logo */}
      <div className="mb-6">
        <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg">
          <span className="text-white font-bold text-2xl">G</span>
        </div>
      </div>

      {/* Title */}
      <h1 className="text-lg font-semibold text-gray-900 mb-2">YouTube GIF Maker</h1>

      {/* Status */}
      {isLoading ? (
        <div className="mb-6">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3"></div>
          <p className="text-sm text-gray-600">Detecting video...</p>
        </div>
      ) : isYouTubePage ? (
        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-2">Video detected!</p>
          {videoTitle && (
            <p className="text-xs font-medium text-gray-900 line-clamp-2 max-w-[280px]">
              &quot;{videoTitle}&quot;
            </p>
          )}
        </div>
      ) : (
        <div className="mb-6">
          <div className="text-3xl mb-3">📺</div>
          <p className="text-sm text-gray-600">Please navigate to a YouTube video</p>
          <p className="text-xs text-gray-500 mt-1">
            Open any YouTube video to start creating GIFs
          </p>
        </div>
      )}

      {/* Action Button */}
      <Button
        variant={isYouTubePage ? 'youtube' : 'outline'}
        onClick={onContinue}
        disabled={!isYouTubePage || isLoading}
        className="w-full max-w-[200px]"
      >
        {isYouTubePage ? 'Get Started' : 'Open YouTube'}
      </Button>

      {/* Quick Links */}
      <div className="mt-6 flex gap-4 text-xs">
        <button className="text-gray-500 hover:text-gray-700">📚 Library</button>
        <button className="text-gray-500 hover:text-gray-700">⚙️ Settings</button>
      </div>
    </div>
  );
};

export default WelcomeScreen;
