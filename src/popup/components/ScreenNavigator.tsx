import React, { useEffect, useState } from 'react';
import { ScreenType } from '../hooks/useScreenNavigation';

interface ScreenNavigatorProps {
  currentScreen: ScreenType;
  previousScreen: ScreenType | null;
  canGoBack: boolean;
  onBack: () => void;
  children: React.ReactNode;
}

const ScreenNavigator: React.FC<ScreenNavigatorProps> = ({
  currentScreen,
  previousScreen,
  canGoBack,
  onBack,
  children
}) => {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionDirection, setTransitionDirection] = useState<'forward' | 'backward'>('forward');

  useEffect(() => {
    if (previousScreen && previousScreen !== currentScreen) {
      // Determine transition direction based on screen order
      const screenOrder: ScreenType[] = [
        'welcome',
        'action-select',
        'quick-capture',
        'custom-range',
        'processing',
        'success'
      ];
      
      const prevIndex = screenOrder.indexOf(previousScreen);
      const currIndex = screenOrder.indexOf(currentScreen);
      
      setTransitionDirection(currIndex > prevIndex ? 'forward' : 'backward');
      setIsTransitioning(true);
      
      // Reset transition state after animation
      const timeout = setTimeout(() => {
        setIsTransitioning(false);
      }, 300);
      
      return () => clearTimeout(timeout);
    }
  }, [currentScreen, previousScreen]);

  // Progress indicator
  const getProgress = (): number => {
    const progressMap: Record<ScreenType, number> = {
      'welcome': 1,
      'action-select': 2,
      'quick-capture': 3,
      'custom-range': 3,
      'processing': 4,
      'success': 5
    };
    return progressMap[currentScreen] || 1;
  };

  const totalSteps = 5;
  const currentStep = getProgress();

  return (
    <div className="h-full flex flex-col">
      {/* Header with Progress */}
      <div className="bg-gradient-to-r from-red-500 to-red-600 text-white px-3 py-2">
        <div className="flex items-center justify-between">
          {/* Back Button */}
          <button
            onClick={onBack}
            disabled={!canGoBack}
            className={`p-1 rounded transition-all ${
              canGoBack 
                ? 'hover:bg-white/20 text-white' 
                : 'text-white/30 cursor-not-allowed'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Title */}
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-white rounded flex items-center justify-center flex-shrink-0">
              <span className="text-red-500 font-bold text-xs">G</span>
            </div>
            <h1 className="font-semibold text-xs">YouTube GIF Maker</h1>
          </div>

          {/* Progress Dots */}
          <div className="flex gap-1">
            {Array.from({ length: totalSteps }).map((_, index) => (
              <div
                key={index}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  index < currentStep
                    ? 'bg-white'
                    : 'bg-white/30'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Content Area with Transitions */}
      <div className="flex-1 relative overflow-hidden">
        <div
          className={`absolute inset-0 transition-transform duration-300 ease-out ${
            isTransitioning
              ? transitionDirection === 'forward'
                ? 'transform translate-x-full'
                : 'transform -translate-x-full'
              : 'transform translate-x-0'
          }`}
          style={{
            animation: isTransitioning
              ? `slide-${transitionDirection} 0.3s ease-out`
              : undefined
          }}
        >
          {children}
        </div>
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes slide-forward {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes slide-backward {
          from {
            transform: translateX(-100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default ScreenNavigator;