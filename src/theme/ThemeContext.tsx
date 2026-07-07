import React, { createContext, useContext, ReactNode } from 'react';
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

  return (
    <ThemeContext.Provider value={{ isDark, themeMode, colors: currentColors }}>
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
