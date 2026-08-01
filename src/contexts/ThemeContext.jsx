import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

export const THEMES = {
  purple: {
    id: 'purple',
    name: 'Purple',
    description: 'Deep purple & lavender',
    preview: { bg: '#3d1a5e', accent: '#a855f7' },
  },
  midnight: {
    id: 'midnight',
    name: 'Black & White',
    description: 'Monochrome elegance',
    preview: { bg: '#1a1a1a', accent: '#ffffff' },
  },
  amber: {
    id: 'amber',
    name: 'Yellow & Black',
    description: 'Bold amber on dark',
    preview: { bg: '#1c1917', accent: '#fbbf24' },
  },
  forest: {
    id: 'forest',
    name: 'Dark Green',
    description: 'Deep forest greens',
    preview: { bg: '#14532d', accent: '#4ade80' },
  },
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('sgms_theme') || 'purple';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('sgms_theme', theme);
  }, [theme]);

  const changeTheme = (newTheme) => {
    if (THEMES[newTheme]) {
      setTheme(newTheme);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, changeTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
};
