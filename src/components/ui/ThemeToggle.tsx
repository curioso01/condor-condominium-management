import React from 'react';
import { Sun, Moon, Laptop } from 'lucide-react';
import { useTheme, type Theme } from '../../contexts/ThemeContext';

interface ThemeToggleProps {
  variant?: 'icon' | 'segmented';
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ variant = 'icon', className = '' }) => {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();

  if (variant === 'segmented') {
    const options: { value: Theme; label: string; icon: React.ReactNode }[] = [
      { value: 'light', label: 'Claro', icon: <Sun className="w-3.5 h-3.5" /> },
      { value: 'dark', label: 'Escuro', icon: <Moon className="w-3.5 h-3.5" /> },
      { value: 'system', label: 'Auto', icon: <Laptop className="w-3.5 h-3.5" /> },
    ];

    return (
      <div
        role="group"
        aria-label="Seleção de tema visual"
        className={`inline-flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 ${className}`}
      >
        {options.map((opt) => {
          const isActive = theme === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTheme(opt.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                isActive
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {opt.icon}
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // Default 'icon' button variant
  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
      title={isDark ? 'Alternar para tema claro' : 'Alternar para tema escuro'}
      className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer border shadow-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
        isDark
          ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-amber-300 hover:text-amber-200 hover:scale-105'
          : 'bg-white hover:bg-slate-50 border-slate-200/80 text-slate-600 hover:text-slate-900 hover:scale-105'
      } ${className}`}
    >
      {isDark ? (
        <Sun className="w-5 h-5 transition-transform duration-300 hover:rotate-45" />
      ) : (
        <Moon className="w-5 h-5 transition-transform duration-300 hover:-rotate-12" />
      )}
    </button>
  );
};
