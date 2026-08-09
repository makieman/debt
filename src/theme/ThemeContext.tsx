import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { useShopProfile } from '../store/ShopProfileContext';

import { lightColors, darkColors, Colors } from './colors';

interface ThemeContextType {
  isDark: boolean;
  themeMode: 'light' | 'dark';
  colors: Colors;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { profile } = useShopProfile();

  const themeMode = profile?.theme || 'dark';
  const isDark = themeMode === 'dark';
  const currentColors = isDark ? darkColors : lightColors;

  // Memoize the context value so its reference only changes when the theme
  // actually changes. Without this, a new object is created on every render
  // of ThemeProvider, causing ALL useThemeContext() consumers (including all
  // 12 NumpadKey components) to re-render on every parent state update.
  const contextValue = useMemo(
    () => ({ isDark, themeMode, colors: currentColors }),
    [isDark, themeMode, currentColors]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
};
