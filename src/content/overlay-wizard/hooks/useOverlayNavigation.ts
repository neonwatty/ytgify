import { useState, useCallback } from 'react';
import { TextOverlay } from '@/types';

type OverlayScreenType =
  | 'welcome'
  | 'quick-capture'
  | 'text-overlay'
  | 'processing'
  | 'success'
  | 'feedback';

interface ScreenData {
  startTime?: number;
  endTime?: number;
  videoDuration?: number;
  currentTime?: number;
  textOverlays?: TextOverlay[];
  resolution?: string;
  frameRate?: number;
  gifSize?: number;
  gifDataUrl?: string;
  gifMetadata?: {
    width: number;
    height: number;
    duration: number;
    frameCount?: number;
  };
  [key: string]: unknown;
}

interface UseOverlayNavigationReturn {
  currentScreen: OverlayScreenType;
  previousScreen: OverlayScreenType | null;
  screenHistory: OverlayScreenType[];
  data: ScreenData;
  canGoBack: boolean;
  goToScreen: (screen: OverlayScreenType) => void;
  goBack: () => void;
  setScreenData: (data: Partial<ScreenData>) => void;
  resetNavigation: () => void;
}

export function useOverlayNavigation(
  initialScreen: OverlayScreenType = 'quick-capture'
): UseOverlayNavigationReturn {
  const [currentScreen, setCurrentScreen] = useState<OverlayScreenType>(initialScreen);
  const [previousScreen, setPreviousScreen] = useState<OverlayScreenType | null>(null);
  const [screenHistory, setScreenHistory] = useState<OverlayScreenType[]>([initialScreen]);
  const [data, setData] = useState<ScreenData>({});

  const goToScreen = useCallback(
    (screen: OverlayScreenType) => {
      setPreviousScreen(currentScreen);
      setCurrentScreen(screen);
      setScreenHistory((prev) => [...prev, screen]);
    },
    [currentScreen]
  );

  const goBack = useCallback(() => {
    if (screenHistory.length > 1) {
      const newHistory = [...screenHistory];
      newHistory.pop(); // Remove current screen
      const prevScreen = newHistory[newHistory.length - 1];

      setPreviousScreen(newHistory.length > 1 ? newHistory[newHistory.length - 2] : null);
      setCurrentScreen(prevScreen);
      setScreenHistory(newHistory);
    }
  }, [screenHistory]);

  const setScreenData = useCallback((newData: Partial<ScreenData>) => {
    setData((prev) => ({ ...prev, ...newData }));
  }, []);

  const resetNavigation = useCallback(() => {
    setCurrentScreen(initialScreen);
    setPreviousScreen(null);
    setScreenHistory([initialScreen]);
    setData({});
  }, [initialScreen]);

  return {
    currentScreen,
    previousScreen,
    screenHistory,
    data,
    canGoBack: screenHistory.length > 1,
    goToScreen,
    goBack,
    setScreenData,
    resetNavigation,
  };
}
