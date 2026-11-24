import React, { useState, useRef, useEffect, useCallback, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';

export interface PremiumDatePickerProps {
  id?: string;
  value: string; // YYYY-MM-DD
  onChange: (isoDate: string) => void;
  min?: string; // YYYY-MM-DD
  max?: string; // YYYY-MM-DD
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  buttonClassName?: string;
  ariaLabel?: string;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseIsoDate(iso: string): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function formatDisplayDate(iso: string): string {
  const dt = parseIsoDate(iso);
  if (!dt) return '';
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Calendário seletor de data de padrão SaaS Premium (WCAG 2.2 AA).
 * Substitui o <input type="date"> nativo do navegador com portal flutuante anti-clip,
 * navegação fluida por mês/ano, atalhos Hoje/Amanhã e harmonia Light/Dark Mode.
 */
export const PremiumDatePicker: React.FC<PremiumDatePickerProps> = ({
  id,
  value,
  onChange,
  min,
  max,
  placeholder = 'Selecionar data',
  disabled = false,
  clearable = false,
  size = 'md',
  className = '',
  buttonClassName = '',
  ariaLabel = 'Selecionar data',
}) => {
  const todayIso = useMemo(() => toIsoDate(new Date()), []);
  const tomorrowIso = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return toIsoDate(d);
  }, []);

  const selectedDate = parseIsoDate(value);

  const [isOpen, setIsOpen] = useState(false);
  const [viewYear, setViewYear] = useState<number>(
    selectedDate ? selectedDate.getFullYear() : new Date().getFullYear()
  );
  const [viewMonth, setViewMonth] = useState<number>(
    selectedDate ? selectedDate.getMonth() : new Date().getMonth()
  );
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      const base = parseIsoDate(value) || new Date();
      setViewYear(base.getFullYear());
      setViewMonth(base.getMonth());
    }
  }, [isOpen, value]);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;
    const popWidth = 308;
    const popHeight = 356;

    const spaceBelow = viewportH - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const openUpward = spaceBelow < popHeight && spaceAbove > spaceBelow;

    let left = rect.left;
    if (left + popWidth > viewportW - 12) {
      left = Math.max(12, viewportW - popWidth - 12);
    }

    setPopoverStyle({
      position: 'fixed',
      left: `${left}px`,
      width: `${popWidth}px`,
      ...(openUpward
        ? { bottom: `${Math.max(12, viewportH - rect.top + 8)}px` }
        : { top: `${Math.min(viewportH - popHeight - 12, rect.bottom + 8)}px` }),
      zIndex: 150,
    });
  }, []);

  useLayoutEffect(() => {
    if (isOpen) {
      updatePosition();
    }
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    const handleScrollResize = (e: Event) => {
      if (popoverRef.current && e.target instanceof Node && popoverRef.current.contains(e.target)) {
        return;
      }
      updatePosition();
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleScrollResize);
    window.addEventListener('scroll', handleScrollResize, true);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleScrollResize);
      window.removeEventListener('scroll', handleScrollResize, true);
    };
  }, [isOpen, updatePosition]);

  const calendarCells = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const startWeekday = firstOfMonth.getDay();
    const startDate = new Date(viewYear, viewMonth, 1 - startWeekday);

    const cells: Array<{
      iso: string;
      day: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      isDisabled: boolean;
    }> = [];

    for (let i = 0; i < 42; i++) {
      const dt = new Date(startDate);
      dt.setDate(startDate.getDate() + i);
      const iso = toIsoDate(dt);
      const isDisabled = Boolean((min && iso < min) || (max && iso > max));
      cells.push({
        iso,
        day: dt.getDate(),
        isCurrentMonth: dt.getMonth() === viewMonth,
        isToday: iso === todayIso,
        isSelected: iso === value,
        isDisabled,
      });
    }
    return cells;
  }, [viewYear, viewMonth, value, todayIso, min, max]);

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectIso = (iso: string) => {
    if ((min && iso < min) || (max && iso > max)) return;
    onChange(iso);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const sizeStyles = {
    xs: 'h-8 px-2.5 text-[11px] rounded-xl gap-1.5',
    sm: 'h-9 px-3 text-xs rounded-xl gap-2',
    md: 'h-11 px-3.5 text-xs sm:text-sm rounded-2xl gap-2',
  };

  const displayText = formatDisplayDate(value);
  const canPickToday = !(min && todayIso < min) && !(max && todayIso > max);
  const canPickTomorrow = !(min && tomorrowIso < min) && !(max && tomorrowIso > max);

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        onClick={() => !disabled && setIsOpen((p) => !p)}
        className={`w-full flex items-center justify-between font-semibold text-left transition-all duration-150 select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 border shadow-xs ${
          isOpen
            ? 'border-emerald-500 ring-2 ring-emerald-500/20 dark:border-emerald-400'
            : 'border-slate-200/90 dark:border-slate-700/80 hover:border-emerald-400/80 dark:hover:border-emerald-600/70 hover:bg-slate-50/70 dark:hover:bg-slate-800'
        } focus:outline-none focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/25 ${sizeStyles[size]} ${buttonClassName}`}
      >
        <span className="flex items-center gap-2 min-w-0 flex-1">
          <CalendarIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span
            className={`truncate tabular-nums ${
              displayText
                ? 'text-slate-800 dark:text-slate-100'
                : 'text-slate-400 dark:text-slate-500 font-normal'
            }`}
          >
            {displayText || placeholder}
          </span>
        </span>
        {clearable && value ? (
          <span
            role="button"
            tabIndex={0}
            aria-label="Limpar data"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onChange('');
              }
            }}
            className="p-0.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </span>
        ) : (
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 shrink-0 hidden sm:inline">
            {selectedDate
              ? selectedDate.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
              : ''}
          </span>
        )}
      </button>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Calendário de seleção de data"
            style={popoverStyle}
            className="bg-white/98 dark:bg-slate-900/98 backdrop-blur-xl rounded-3xl border border-slate-200/90 dark:border-slate-700/90 shadow-[0_20px_54px_-12px_rgba(15,23,42,0.32)] dark:shadow-[0_24px_60px_-12px_rgba(0,0,0,0.85)] p-4 animate-in fade-in zoom-in-95 duration-150 select-none"
          >
            {/* Header Mês / Ano */}
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={goPrevMonth}
                aria-label="Mês anterior"
                className="w-8 h-8 rounded-xl border border-slate-200/80 dark:border-slate-700/80 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center justify-center transition cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="text-center">
                <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                  {MONTHS_PT[viewMonth]}
                </span>{' '}
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {viewYear}
                </span>
              </div>

              <button
                type="button"
                onClick={goNextMonth}
                aria-label="Próximo mês"
                className="w-8 h-8 rounded-xl border border-slate-200/80 dark:border-slate-700/80 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center justify-center transition cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Dias da Semana */}
            <div className="grid grid-cols-7 gap-1 mb-1.5 text-center">
              {WEEKDAYS.map((w) => (
                <span
                  key={w}
                  className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 py-1"
                >
                  {w}
                </span>
              ))}
            </div>

            {/* Grade de Dias */}
            <div className="grid grid-cols-7 gap-1">
              {calendarCells.map((cell) => (
                <button
                  key={cell.iso}
                  type="button"
                  disabled={cell.isDisabled}
                  onClick={() => handleSelectIso(cell.iso)}
                  aria-label={formatDisplayDate(cell.iso)}
                  aria-pressed={cell.isSelected}
                  className={`h-8 w-full rounded-xl text-xs font-semibold tabular-nums flex items-center justify-center transition-all cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed ${
                    cell.isSelected
                      ? 'bg-emerald-600 text-white font-extrabold shadow-pill scale-[1.03]'
                      : cell.isToday
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/60 font-extrabold hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
                      : cell.isCurrentMonth
                      ? 'text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                      : 'text-slate-400/60 dark:text-slate-600 hover:bg-slate-100/60 dark:hover:bg-slate-800/40'
                  }`}
                >
                  {cell.day}
                </button>
              ))}
            </div>

            {/* Rodapé com atalhos rápidos */}
            <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {canPickToday && (
                  <button
                    type="button"
                    onClick={() => handleSelectIso(todayIso)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition cursor-pointer"
                  >
                    Hoje
                  </button>
                )}
                {canPickTomorrow && (
                  <button
                    type="button"
                    onClick={() => handleSelectIso(tomorrowIso)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                  >
                    Amanhã
                  </button>
                )}
              </div>

              {clearable && value ? (
                <button
                  type="button"
                  onClick={() => {
                    onChange('');
                    setIsOpen(false);
                  }}
                  className="px-2 py-1 rounded-lg text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                >
                  Limpar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
                >
                  Fechar
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
