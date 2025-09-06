import { useEffect, useRef } from 'react';
import { ScreenType } from './useScreenNavigation';

interface AutoProgressionConfig {
  currentScreen: ScreenType;
  condition: boolean;
  nextScreen: ScreenType;
  delay?: number;
  onProgress?: () => void;
}

export function useAutoProgression({
  currentScreen,
  condition,
  nextScreen,
  delay = 500,
  onProgress
}: AutoProgressionConfig) {
  const hasProgressedRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Reset progression flag when screen changes
    hasProgressedRef.current = false;
    
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Check if we should auto-progress
    if (condition && !hasProgressedRef.current) {
      hasProgressedRef.current = true;
      
      timeoutRef.current = setTimeout(() => {
        if (onProgress) {
          onProgress();
        }
      }, delay);
    }

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [currentScreen, condition, nextScreen, delay, onProgress]);
}