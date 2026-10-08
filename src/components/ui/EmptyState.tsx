import React from 'react';
import { cn } from '../../lib/utils';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-3xl border border-dashed border-slate-200 bg-slate-50/50',
        className
      )}
      role="status"
    >
      <div className="w-12 h-12 rounded-2xl bg-white shadow-soft border border-slate-100 flex items-center justify-center text-slate-400 mb-3.5">
        {icon || (
          <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
          </svg>
        )}
      </div>
      <h3 className="text-sm font-bold text-slate-800 tracking-tight">{title}</h3>
      <p className="mt-1 max-w-sm text-xs text-slate-500 leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 px-4 py-2 rounded-full text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-pill transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
