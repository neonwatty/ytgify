import { useState, useCallback, useEffect } from 'react';

export type ScreenType =
  | 'welcome'
  | 'action-select'
  | 'quick-capture'
  | 'processing'
  | 'success';

interface NavigationState {
  currentScreen: ScreenType;
  previousScreen: ScreenType | null;
  history: ScreenType[];
  data: Record<string, any>;
}

interface UseScreenNavigationReturn {
  currentScreen: ScreenType;
  previousScreen: ScreenType | null;
  history: ScreenType[];
  data: Record<string, any>;
  goToScreen: (screen: ScreenType, data?: Record<string, any>) => void;
  goBack: () => void;
  goForward: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  setScreenData: (data: Record<string, any>) => void;
  resetNavigation: () => void;
}

const STORAGE_KEY = 'ytgif-popup-nav-state';

export function useScreenNavigation(initialScreen: ScreenType = 'welcome'): UseScreenNavigationReturn {
  const [state, setState] = useState<NavigationState>(() => {
    // Try to restore state from localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Only restore if popup was recently opened (within 5 minutes)
        if (Date.now() - parsed.timestamp < 5 * 60 * 1000) {
          return parsed.state;
        }
      }
    } catch (error) {
      console.error('Failed to restore navigation state:', error);
    }
    
    return {
      currentScreen: initialScreen,
      previousScreen: null,
      history: [initialScreen],
      data: {}
    };
  });

  // Save state to localStorage on changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        state,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Failed to save navigation state:', error);
    }
  }, [state]);

  const goToScreen = useCallback((screen: ScreenType, data?: Record<string, any>) => {
    setState(prev => ({
      currentScreen: screen,
      previousScreen: prev.currentScreen,
      history: [...prev.history, screen],
      data: data ? { ...prev.data, ...data } : prev.data
    }));
  }, []);

  const goBack = useCallback(() => {
    setState(prev => {
      const currentIndex = prev.history.findIndex(s => s === prev.currentScreen);
      if (currentIndex > 0) {
        const newScreen = prev.history[currentIndex - 1];
        return {
          ...prev,
          currentScreen: newScreen,
          previousScreen: prev.currentScreen
        };
      }
      return prev;
    });
  }, []);

  const goForward = useCallback(() => {
    setState(prev => {
      const currentIndex = prev.history.findIndex(s => s === prev.currentScreen);
      if (currentIndex < prev.history.length - 1) {
        const newScreen = prev.history[currentIndex + 1];
        return {
          ...prev,
          currentScreen: newScreen,
          previousScreen: prev.currentScreen
        };
      }
      return prev;
    });
  }, []);

  const setScreenData = useCallback((data: Record<string, any>) => {
    setState(prev => ({
      ...prev,
      data: { ...prev.data, ...data }
    }));
  }, []);

  const resetNavigation = useCallback(() => {
    setState({
      currentScreen: initialScreen,
      previousScreen: null,
      history: [initialScreen],
      data: {}
    });
    localStorage.removeItem(STORAGE_KEY);
  }, [initialScreen]);

  const currentIndex = state.history.findIndex(s => s === state.currentScreen);
  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex < state.history.length - 1;

  return {
    currentScreen: state.currentScreen,
    previousScreen: state.previousScreen,
    history: state.history,
    data: state.data,
    goToScreen,
    goBack,
    goForward,
    canGoBack,
    canGoForward,
    setScreenData,
    resetNavigation
  };
}