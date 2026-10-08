import React from 'react';
import { cn } from '../../lib/utils';

interface StatCardProps {
  label: string;
  value: string;
  unit?: string;
  delta?: {
    value: string;
    positive?: boolean;
    comparison?: string;
  };
  pillText?: string;
  pillVariant?: 'emerald' | 'amber' | 'slate';
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  unit,
  delta,
  pillText,
  pillVariant = 'emerald',
  icon,
  children,
  className,
}) => {
  return (
    <article
      className={cn(
        'bg-white rounded-3xl p-6 shadow-bento border border-slate-100 flex flex-col justify-between relative overflow-hidden group hover:shadow-bento-hover transition-all duration-300',
        className
      )}
    >
      <div>
        <div className="flex items-start justify-between">
          <div>
            {pillText && (
              <div
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold mb-2',
                  pillVariant === 'emerald' && 'bg-emerald-50 text-emerald-700',
                  pillVariant === 'amber' && 'bg-amber-50 text-amber-700',
                  pillVariant === 'slate' && 'bg-slate-100 text-slate-700'
                )}
              >
                <span
                  className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    pillVariant === 'emerald' && 'bg-emerald-600',
                    pillVariant === 'amber' && 'bg-amber-500',
                    pillVariant === 'slate' && 'bg-slate-500'
                  )}
                  aria-hidden="true"
                />
                <span>{pillText}</span>
              </div>
            )}
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</h3>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-extrabold text-slate-900 tracking-tight tabular-nums">
                {value}
              </span>
              {unit && <span className="text-sm font-semibold text-slate-400">{unit}</span>}
              {delta && (
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full',
                    delta.positive !== false
                      ? 'text-emerald-700 bg-emerald-50'
                      : 'text-rose-700 bg-rose-50'
                  )}
                >
                  <span aria-hidden="true">{delta.positive !== false ? '↑' : '↓'}</span>
                  <span>{delta.value}</span>
                </span>
              )}
            </div>
            {delta?.comparison && (
              <span className="text-[11px] text-slate-400 block mt-0.5">{delta.comparison}</span>
            )}
          </div>
          {icon && (
            <div className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600 shrink-0">
              {icon}
            </div>
          )}
        </div>
      </div>
      {children}
    </article>
  );
};
