import React from 'react';
import { cn } from '../../lib/utils';

export type BadgeVariant = 'emerald' | 'amber' | 'rose' | 'sky' | 'slate' | 'outline';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

const badgeVariants: Record<BadgeVariant, string> = {
  emerald: 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/60',
  amber: 'bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/60',
  rose: 'bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border-rose-200/60 dark:border-rose-800/60',
  sky: 'bg-sky-50 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border-sky-200/60 dark:border-sky-800/60',
  slate: 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200/60 dark:border-slate-700/60',
  outline: 'bg-transparent text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700',
};

const dotColors: Record<BadgeVariant, string> = {
  emerald: 'bg-emerald-600 dark:bg-emerald-400',
  amber: 'bg-amber-500 dark:bg-amber-400',
  rose: 'bg-rose-600 dark:bg-rose-400',
  sky: 'bg-sky-500 dark:bg-sky-400',
  slate: 'bg-slate-500 dark:bg-slate-400',
  outline: 'bg-slate-400 dark:bg-slate-500',
};

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'slate',
  dot = false,
  children,
  ...props
}) => {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition-colors select-none',
        badgeVariants[variant],
        className
      )}
      {...props}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColors[variant])} aria-hidden="true" />}
      {children}
    </span>
  );
};
