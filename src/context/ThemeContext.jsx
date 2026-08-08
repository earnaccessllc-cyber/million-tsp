import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

// 'auto' means follow system dark/light; other values are explicit overrides
const VALID_THEMES = ['black', 'light', 'auto'];

function normalizeTheme(t) {
  return VALID_THEMES.includes(t) ? t : 'black';
}

export function ThemeProvider({ children }) {
  const [theme, setThemeRaw] = useState(() => normalizeTheme(localStorage.getItem('tsp-theme')));

  // Apply theme to document
  useEffect(() => {
    const applyTheme = (t) => {
      let isDark;
      if (t === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', prefersDark ? 'black' : 'light');
        isDark = prefersDark;
      } else {
        const normalized = normalizeTheme(t);
        document.documentElement.setAttribute('data-theme', normalized);
        isDark = normalized === 'black';
      }
      // Toggle Tailwind 'dark' class so dark: variant utilities apply consistently
      document.documentElement.classList.toggle('dark', isDark);
    };

    applyTheme(theme);

    // Listen for system changes when in auto mode
    if (theme === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme('auto');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [theme]);

  const setTheme = (t) => {
    const normalized = normalizeTheme(t);
    localStorage.setItem('tsp-theme', normalized);
    setThemeRaw(normalized);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}