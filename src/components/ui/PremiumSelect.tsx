import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

export interface PremiumSelectOption {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface PremiumSelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<string | PremiumSelectOption>;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  ariaLabel?: string;
  size?: 'xs' | 'sm' | 'md';
  icon?: React.ReactNode;
}

function normalizeOptions(options: Array<string | PremiumSelectOption>): PremiumSelectOption[] {
  return options.map((opt) =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  );
}

/**
 * Dropdown seletor customizado de padrão SaaS Premium (WCAG 2.2 AA).
 * Substitui o <select> nativo do navegador com portal flutuante anti-clip,
 * navegação completa por teclado e harmonia Light/Dark Mode.
 */
export const PremiumSelect: React.FC<PremiumSelectProps> = ({
  id,
  value,
  onChange,
  options,
  placeholder = 'Selecionar...',
  disabled = false,
  className = '',
  buttonClassName = '',
  ariaLabel,
  size = 'md',
  icon,
}) => {
  const normalized = normalizeOptions(options);
  const selectedIndex = normalized.findIndex((o) => o.value === value);
  const selectedOption = selectedIndex >= 0 ? normalized[selectedIndex] : null;

  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(
    selectedIndex >= 0 ? selectedIndex : 0
  );
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const estimatedHeight = Math.min(272, normalized.length * 42 + 16);
    const spaceBelow = viewportHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const openUpward = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

    const minWidth = Math.max(rect.width, 180);
    const maxWidth = Math.min(Math.max(rect.width, 280), viewportWidth - 24);
    let left = rect.left;
    if (left + minWidth > viewportWidth - 12) {
      left = Math.max(12, viewportWidth - minWidth - 12);
    }

    setMenuStyle({
      position: 'fixed',
      left: `${left}px`,
      width: `${Math.min(Math.max(rect.width, minWidth), maxWidth)}px`,
      ...(openUpward
        ? { bottom: `${viewportHeight - rect.top + 6}px` }
        : { top: `${rect.bottom + 6}px` }),
      zIndex: 140,
    });
  }, [normalized.length]);

  useLayoutEffect(() => {
    if (isOpen) {
      updatePosition();
    }
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    const handleWindowScrollOrResize = (e: Event) => {
      if (menuRef.current && e.target instanceof Node && menuRef.current.contains(e.target)) {
        return;
      }
      updatePosition();
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('resize', handleWindowScrollOrResize);
    window.addEventListener('scroll', handleWindowScrollOrResize, true);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', handleWindowScrollOrResize);
      window.removeEventListener('scroll', handleWindowScrollOrResize, true);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (isOpen && optionRefs.current[highlightedIndex]) {
      optionRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [isOpen, highlightedIndex]);

  const handleToggle = () => {
    if (disabled) return;
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
      }
      return next;
    });
  };

  const handleSelectOption = (opt: PremiumSelectOption) => {
    if (opt.disabled) return;
    onChange(opt.value);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
        return;
      }
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      setHighlightedIndex((prev) => {
        const next = (prev + delta + normalized.length) % normalized.length;
        return next;
      });
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
      } else if (normalized[highlightedIndex]) {
        handleSelectOption(normalized[highlightedIndex]);
      }
    } else if (e.key === 'Home' && isOpen) {
      e.preventDefault();
      setHighlightedIndex(0);
    } else if (e.key === 'End' && isOpen) {
      e.preventDefault();
      setHighlightedIndex(Math.max(0, normalized.length - 1));
    } else if (e.key === 'Tab' && isOpen) {
      setIsOpen(false);
    }
  };

  const sizeStyles = {
    xs: 'h-8 px-2.5 text-[11px] rounded-xl gap-1.5',
    sm: 'h-9 px-3 text-xs rounded-xl gap-2',
    md: 'h-11 px-3.5 text-xs sm:text-sm rounded-2xl gap-2',
  };

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        onClick={handleToggle}
        onKeyDown={handleTriggerKeyDown}
        className={`w-full flex items-center justify-between font-semibold text-left transition-all duration-150 select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 border shadow-xs ${
          isOpen
            ? 'border-emerald-500 ring-2 ring-emerald-500/20 dark:border-emerald-400'
            : 'border-slate-200/90 dark:border-slate-700/80 hover:border-emerald-400/80 dark:hover:border-emerald-600/70 hover:bg-slate-50/70 dark:hover:bg-slate-800'
        } focus:outline-none focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/25 ${sizeStyles[size]} ${buttonClassName}`}
      >
        <span className="flex items-center gap-2 min-w-0 flex-1">
          {(selectedOption?.icon || icon) && (
            <span className="shrink-0 flex items-center text-emerald-600 dark:text-emerald-400">
              {selectedOption?.icon || icon}
            </span>
          )}
          <span
            className={`truncate ${
              selectedOption
                ? 'text-slate-800 dark:text-slate-100'
                : 'text-slate-400 dark:text-slate-500 font-normal'
            }`}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 dark:text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-emerald-600 dark:text-emerald-400' : ''
          }`}
        />
      </button>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            style={menuStyle}
            className="bg-white/98 dark:bg-slate-900/98 backdrop-blur-xl rounded-2xl border border-slate-200/90 dark:border-slate-700/90 shadow-[0_18px_48px_-12px_rgba(15,23,42,0.28)] dark:shadow-[0_22px_54px_-12px_rgba(0,0,0,0.8)] p-1.5 max-h-64 overflow-y-auto animate-in fade-in zoom-in-95 duration-150"
          >
            {normalized.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-slate-400">
                Nenhuma opção disponível
              </div>
            ) : (
              normalized.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isHighlighted = idx === highlightedIndex;
                return (
                  <button
                    key={`${opt.value}-${idx}`}
                    ref={(el) => {
                      optionRefs.current[idx] = el;
                    }}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={opt.disabled}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onClick={() => handleSelectOption(opt)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between gap-2.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold'
                        : isHighlighted
                        ? 'bg-slate-100/90 dark:bg-slate-800/90 text-slate-900 dark:text-slate-100 font-medium'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                      <div className="min-w-0">
                        <span className="block text-xs sm:text-[13px] truncate leading-snug">
                          {opt.label}
                        </span>
                        {opt.description && (
                          <span className="block text-[10px] text-slate-400 dark:text-slate-400 truncate mt-0.5 font-normal">
                            {opt.description}
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>,
          document.body
        )}
    </div>
  );
};
