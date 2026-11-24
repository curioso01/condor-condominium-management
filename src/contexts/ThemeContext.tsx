import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { flushSync } from 'react-dom';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'condor_theme_preference';

const applyThemeToDom = (resolved: 'light' | 'dark') => {
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
};

/**
 * Troca de tema instantânea e fluida:
 * - Desliga temporariamente as transições de cor de todos os elementos (evita o efeito "arrastado"
 *   de centenas de componentes animando em velocidades diferentes).
 * - Aplica a classe `dark` de forma síncrona no <html>, sem esperar o ciclo de render do React.
 * - Quando suportado, usa a View Transition API para um cross-fade curto (180ms) e uniforme.
 */
const runThemeSwitch = (nextResolved: 'light' | 'dark', commit: () => void) => {
  const root = document.documentElement;
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const swap = () => {
    root.classList.add('theme-switching');
    applyThemeToDom(nextResolved);
    flushSync(commit);
    // Força o cálculo dos estilos finais antes de reativar as transições
    void window.getComputedStyle(root).backgroundColor;
    requestAnimationFrame(() => {
      root.classList.remove('theme-switching');
    });
  };

  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => unknown;
  };

  if (!prefersReducedMotion && typeof doc.startViewTransition === 'function') {
    doc.startViewTransition(swap);
  } else {
    swap();
  }
};

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

  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Listen to OS system theme changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setSystemIsDark(e.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Compute resolvedTheme
  const resolvedTheme: 'light' | 'dark' = useMemo(() => {
    if (theme === 'system') {
      return systemIsDark ? 'dark' : 'light';
    }
    return theme;
  }, [theme, systemIsDark]);

  // Apply to document.documentElement (carga inicial e mudanças do tema do sistema)
  useEffect(() => {
    applyThemeToDom(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = (newTheme: Theme) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch {
      // ignore
    }

    const nextResolved: 'light' | 'dark' =
      newTheme === 'system' ? (systemIsDark ? 'dark' : 'light') : newTheme;

    if (nextResolved === resolvedTheme || typeof document === 'undefined') {
      setThemeState(newTheme);
      return;
    }

    runThemeSwitch(nextResolved, () => setThemeState(newTheme));
  };

  const toggleTheme = () => {
    const nextTheme: Theme = resolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      toggleTheme,
    }),
    [theme, resolvedTheme]
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
