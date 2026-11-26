import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'condor_theme_preference';

let unlockTransitionsFrame: number | null = null;

function applyResolvedThemeToDom(resolved: 'light' | 'dark', instant = true) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  if (instant) {
    root.classList.add('theme-switching');
  }

  if (resolved === 'dark') {
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
  }

  if (instant) {
    // Força aplicação síncrona do novo estilo em um único frame antes de reabilitar transições de hover
    void window.getComputedStyle(root).backgroundColor;
    if (unlockTransitionsFrame !== null) {
      cancelAnimationFrame(unlockTransitionsFrame);
    }
    unlockTransitionsFrame = requestAnimationFrame(() => {
      root.classList.remove('theme-switching');
      unlockTransitionsFrame = null;
    });
  }
}

function getSystemDarkPreference(): boolean {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored;
      }
    } catch {
      // Fallback if localStorage is inaccessible
    }
    return 'light';
  });

  const [systemIsDark, setSystemIsDark] = useState<boolean>(getSystemDarkPreference);

  // Listen to OS system theme changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setSystemIsDark(e.matches);
      if (theme === 'system') {
        applyResolvedThemeToDom(e.matches ? 'dark' : 'light', true);
      }
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme]);

  // Compute resolvedTheme
  const resolvedTheme: 'light' | 'dark' = useMemo(() => {
    if (theme === 'system') {
      return systemIsDark ? 'dark' : 'light';
    }
    return theme;
  }, [theme, systemIsDark]);

  // Garante sincronia inicial na montagem sem atrasar cliques subsequentes
  useEffect(() => {
    applyResolvedThemeToDom(resolvedTheme, false);
  }, [resolvedTheme]);

  const setTheme = useCallback((newTheme: Theme) => {
    const nextResolved: 'light' | 'dark' =
      newTheme === 'system' ? (getSystemDarkPreference() ? 'dark' : 'light') : newTheme;

    // Aplica no DOM imediatamente no clique (0ms de espera pelo ciclo do React)
    applyResolvedThemeToDom(nextResolved, true);
    setThemeState(newTheme);

    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch {
      // ignore
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const isCurrentlyDark =
      typeof document !== 'undefined'
        ? document.documentElement.classList.contains('dark')
        : resolvedTheme === 'dark';
    const nextTheme: Theme = isCurrentlyDark ? 'light' : 'dark';
    setTheme(nextTheme);
  }, [resolvedTheme, setTheme]);

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      toggleTheme,
    }),
    [theme, resolvedTheme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
